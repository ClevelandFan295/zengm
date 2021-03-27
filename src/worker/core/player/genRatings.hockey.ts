import { PHASE } from "../../../common";
import genFuzz from "./genFuzz";
import limitRating from "./limitRating";
import posHockey from "./pos.hockey";
import { g, helpers, random } from "../../util";
import { POSITION_COUNTS } from "../../../common/constants.hockey";
import type { PlayerRatings } from "../../../common/types.hockey";

const getPos = () => {
	const numPlayers = Object.values(POSITION_COUNTS).reduce((sum, val) => {
		return sum + val;
	}, 0);
	const rand = Math.random() * numPlayers;
	let cumsum = 0;

	for (const [pos, count] of Object.entries(POSITION_COUNTS)) {
		cumsum += count;

		if (rand < cumsum) {
			// Hacky - make more defensemen
			if (pos === "C" && Math.random() < 0.25) {
				return "D";
			}

			return pos;
		}
	}

	throw new Error("No position found - this should never happen!");
};

const getRatingsToBoost = (pos: string) => {
	if (pos === "C") {
		// Offensive or defensive?
		const offensive = Math.random() < 0.5;

		// Scoring or passing?
		if (Math.random() < 0.5) {
			return {
				stre: 1,
				spd: 2.5,
				endu: 1,
				pss: offensive ? 1 : 0.5,
				wst: 2,
				sst: 1.5,
				stk: offensive ? 1.5 : 1,
				oiq: offensive ? 1.5 : 1,
				chk: offensive ? 1 : 2,
				blk: offensive ? 1 : 2,
				fcf: 2,
				diq: offensive ? 1 : 2,
			};
		}

		return {
			stre: 1,
			spd: 2.5,
			endu: 1,
			pss: offensive ? 2 : 1.5,
			wst: 1,
			sst: 1,
			stk: offensive ? 1.5 : 1,
			oiq: offensive ? 2 : 0.5,
			chk: offensive ? 1 : 2,
			blk: offensive ? 1 : 2,
			fcf: 2,
			diq: offensive ? 1 : 2,
		};
	}

	if (pos === "W") {
		return {
			stre: 1,
			spd: 1.5,
			endu: 1,
			pss: 1,
			wst: 2,
			sst: 2,
			stk: 1.5,
			oiq: 2,
			fcf: 1,
		};
	}

	if (pos === "D") {
		// Offensive or defensive?
		if (Math.random() < 0.5) {
			return {
				hgt: 1.25,
				stre: 2,
				endu: 1,
				wst: 1.5,
				sst: 2,
				chk: 1.5,
				blk: 1.5,
				diq: 1.5,
			};
		}
		return {
			hgt: 1.25,
			stre: 2,
			endu: 1,
			wst: 1,
			sst: 1.5,
			chk: 2,
			blk: 2,
			diq: 2,
		};
	}

	if (pos === "G") {
		return {
			glk: 1.5,
		};
	}

	throw new Error(`Invalid position "${pos}"`);
};

// 5'4" to 6'10"
const heightToInches = (hgt: number) => {
	return Math.round(64 + (hgt * (82 - 64)) / 100);
};

/*const info = {};
const infoIn = {};
const infoOut = {};
let timeoutID;*/

const initialRating = () => limitRating(random.truncGauss(7, 5, 0, 15));

const defaultOvrsOrPots = {
	C: 0,
	W: 0,
	D: 0,
	G: 0,
};

const genRatings = (
	season: number,
	scoutingRank: number,
): {
	heightInInches: number;
	ratings: PlayerRatings;
} => {
	const pos = getPos();

	const rawRatings = {
		hgt: initialRating() + 30,
		stre: initialRating(),
		spd: initialRating(),
		endu: initialRating() + 30,
		pss: initialRating(),
		wst: initialRating(),
		sst: initialRating(),
		stk: initialRating(),
		oiq: initialRating(),
		chk: initialRating(),
		blk: initialRating(),
		fcf: initialRating(),
		diq: initialRating(),
		glk: initialRating(),
	};

	const ratingsToBoost = getRatingsToBoost(pos);

	for (const rating of helpers.keys(ratingsToBoost)) {
		const factor = ratingsToBoost[rating];
		if (factor !== undefined) {
			rawRatings[rating] = limitRating(
				(rawRatings[rating] += factor * random.truncGauss(10, 15, 8, 30)),
			);
		}
	}

	const ratings = {
		hgt: rawRatings.hgt,
		stre: rawRatings.stre,
		spd: rawRatings.spd,
		endu: rawRatings.endu,
		pss: rawRatings.pss,
		wst: rawRatings.wst,
		sst: rawRatings.sst,
		stk: rawRatings.stk,
		oiq: rawRatings.oiq,
		chk: rawRatings.chk,
		blk: rawRatings.blk,
		fcf: rawRatings.fcf,
		diq: rawRatings.diq,
		glk: rawRatings.glk,
		fuzz: genFuzz(scoutingRank),
		ovr: 0,
		pos,
		pot: 0,
		season,
		skills: [],
		ovrs: { ...defaultOvrsOrPots },
		pots: { ...defaultOvrsOrPots },
	};

	// Youngest prospects !== 18 will be scaled, scaling stops at age 13 and 26
	let age = g.get("draftAge")[0];
	age = helpers.bound(age, 13, 26);
	if (age !== 18) {
		const scale = 3 * (18 - age);
		const rtgs = [
			"stre",
			"spd",
			"endu",
			"pss",
			"wst",
			"sst",
			"stk",
			"oiq",
			"chk",
			"blk",
			"fcf",
			"diq",
			"glk",
		] as const;

		for (const rtg of rtgs) {
			if (rtg === "spd") {
				ratings[rtg] -= Math.round(scale / 2);
			} else {
				ratings[rtg] -= scale;
			}
			ratings[rtg] = helpers.bound(ratings[rtg], 0, 100);
		}
	}

	// Higher fuzz for draft prospects
	if (g.get("phase") >= PHASE.RESIGN_PLAYERS) {
		if (season === g.get("season") + 2) {
			ratings.fuzz *= Math.sqrt(2);
		} else if (season >= g.get("season") + 3) {
			ratings.fuzz *= 2;
		}
	} else {
		if (season === g.get("season") + 1) {
			ratings.fuzz *= Math.sqrt(2);
		} else if (season >= g.get("season") + 2) {
			ratings.fuzz *= 2;
		}
	}

	ratings.pos = posHockey(ratings);

	/*info[`${pos}->${ratings.pos}`] =
		info[`${pos}->${ratings.pos}`] === undefined
			? 1
			: info[`${pos}->${ratings.pos}`] + 1;
	infoIn[pos] = infoIn[pos] === undefined ? 1 : infoIn[pos] + 1;
	infoOut[ratings.pos] =
		infoOut[ratings.pos] === undefined ? 1 : infoOut[ratings.pos] + 1;
	clearTimeout(timeoutID);
     timeoutID = setTimeout(() => {
         console.log(info);
         for (const pos2 of POSITIONS) {
             if (infoIn.hasOwnProperty(pos2)) {
                 console.log(pos2, infoIn[pos2], infoOut[pos2]);
             }
         }
	 }, 1000);*/

	/*    if (pos === "DL" && ratings.pos === "LB") {
         console.log(ratings);
         debugger;
     }*/

	return {
		heightInInches: heightToInches(ratings.hgt),
		ratings,
	};
};

export default genRatings;
