//
// hints.js
// @trenskow/arguments-parser
//
// Created by Kristian Trenskow on 2028/08/04
// See license in LICENSE.
//

export default () => ({
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
});
