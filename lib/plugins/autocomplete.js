//
// autocomplete.js
// @trenskow/arguments-parser
//
// Created by Kristian Trenskow on 2028/08/04
// See license in LICENSE.
//

export default () => ({
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
});
