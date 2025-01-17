import { season } from "../core";
import { idb } from "../db";
import { g, helpers } from "../util";
import type {
	UpdateEvents,
	ViewInput,
	PlayoffSeries,
} from "../../common/types";

type SeriesTeam = {
	abbrev: string;
	cid: number;
	imgURL?: string;
	imgURLSmall?: string;
	pts?: number;
	region: string;
	regularSeason: {
		won: number;
		lost: number;
		tied?: number;
		otl?: number;
	};
	seed: number;
	tid: number;
	winp: number;
	won?: number;
};

const getProjectedSeries = async () => {
	const result = await season.genPlayoffSeries();
	return result.series;
};

const updatePlayoffs = async (
	inputs: ViewInput<"playoffs">,
	updateEvents: UpdateEvents,
	state: any,
): Promise<{
	confNames: string[];
	finalMatchups: boolean;
	matchups: {
		matchup: [number, number];
		rowspan: number;
	}[][];
	numGamesPlayoffSeries: number[];
	numGamesToWinSeries: number[];
	playoffsByConf: boolean;
	season: number;
	series: {
		home: SeriesTeam;
		away?: SeriesTeam;
	}[][];
	userTid: number;
} | void> => {
	if (
		updateEvents.includes("firstRun") ||
		inputs.season !== state.season ||
		(inputs.season === g.get("season") && updateEvents.includes("gameSim"))
	) {
		let finalMatchups = false;
		let series: PlayoffSeries["series"];

		const playoffSeries = await idb.getCopy.playoffSeries({
			season: inputs.season,
		});

		if (playoffSeries) {
			series = playoffSeries.series;
			finalMatchups = true;
		} else {
			series = await getProjectedSeries();
		}

		await helpers.augmentSeries(series, inputs.season);

		// Because augmentSeries mutates series, this is for TypeScript
		const series2 = series as {
			home: SeriesTeam;
			away?: SeriesTeam;
		}[][];

		// Formatting for the table in playoffs.html
		const matchups: {
			rowspan: number;
			matchup: [number, number];
		}[][] = [];

		for (let i = 0; i < 2 ** (series.length - 2); i++) {
			matchups[i] = [];
		}

		// Fill in with each round. Good lord, this is confusing, due to having to assemble it for an HTML table with rowspans.
		for (let i = 0; i < series.length; i++) {
			let numGamesInSide = 2 ** (series.length - i - 2);

			if (numGamesInSide < 1) {
				numGamesInSide = 1;
			}

			const rowspan = 2 ** i;

			for (let j = 0; j < numGamesInSide; j++) {
				matchups[j * rowspan].splice(i, 0, {
					rowspan,
					matchup: [i, j],
				});

				if (series.length !== i + 1) {
					matchups[j * rowspan].splice(i, 0, {
						rowspan,
						matchup: [i, numGamesInSide + j],
					});
				}
			}
		}

		const confNames = g.get("confs", inputs.season).map(conf => conf.name); // Display the current or archived playoffs

		const numGamesPlayoffSeries = g.get("numGamesPlayoffSeries", inputs.season);

		const playoffsByConf = await season.getPlayoffsByConf(inputs.season);

		return {
			confNames,
			finalMatchups,
			matchups,
			numGamesPlayoffSeries,
			numGamesToWinSeries: numGamesPlayoffSeries.map(
				helpers.numGamesToWinSeries,
			),
			playoffsByConf,
			season: inputs.season,
			series: series2,
			userTid: g.get("userTid"),
		};
	}
};

export default updatePlayoffs;
