//
// index.js
// @trenskow/arguments-parser
//
// Created by Kristian Trenskow on 2024/12/18
// See license in LICENSE.
//

import {
	basename,
	extname
} from 'path';

import {
	plugins
} from 'isvalid';

import argumentsParser from './lib/index.js';
import autocomplete from './lib/autocomplete/index.js';

plugins.use('argumentsParser.dummies', () => ({
	phase: 'pre',
	supportsType: () => true,
	validatorsForType: () => ({
		description: ['string'],
		defaultDescription: ['string'],
		secret: ['boolean'],
		short: ['string']
	}),
	validate: (data) => data,
	formalize: (schema) => schema
}));

plugins.use('argumentsParser.hints', () => ({
	phase: 'pre',
	supportsType: () => true,
	validatorsForType: () => ({
		hints: ['array', 'string']
	}),
	validate: (data) => data,
	formalize: (data, _, schema) => {

		if (!Array.isArray(data)) data = [data];

		if (schema.errors.hints) {
			data.push(schema.errors.hints);
			delete schema.errors.hints;
		}

		if (data.some((data) => typeof data !== 'string')) throw new Error('Must be a string.');

		return data;

	}
}));

plugins.use('argumentsParser.autocomplete', () => ({
	phase: 'pre',
	supportsType: () => true,
	validatorsForType: () => ({
		autocomplete: ['array', 'function']
	}),
	validate: (data) => data,
	formalize: (data) => {

		if (!(Array.isArray(data) && data.every((data) => typeof data === 'string')) && typeof data !== 'function') {
			throw new Error('Must be a string or a function.');
		}

		return data;

	}
}));

if (process.argv[2] === '_completion') {

	let command = basename(process.env.COMPLETION_PATH || process.argv[1]);

	const ext = extname(command);

	if (ext.length) command = command.slice(0, -ext.length);

	autocomplete.script({
		shell: process.argv[3],
		command
	});

	process.exit(0);

}

export default typeof process.env.AUTOCOMPLETE_INDEX !== 'undefined' ? autocomplete() : argumentsParser;
