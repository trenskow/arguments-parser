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

		if (!Array.isArray(data)) data = [data];

		data
			.forEach((item) => {

				if (typeof item === 'string') {
					item = {
						type: 'option',
						argument: item
					};
				}

				if (typeof item?.type !== 'string') {
					throw new Error('Autocomplete item must have a type.');
				}

				if (!['command', 'option', 'files'].includes(item.type)) {
					throw new Error('Autocomplete item type must be one of: command, option, files.');
				}

				if (item.type !== 'files') {

					if (typeof item?.argument !== 'string') {
						throw new Error('Autocomplete item must have an argument.');
					}

					if (typeof item?.description !== 'undefined' && typeof item?.description !== 'string') {
						throw new Error('Autocomplete item description must be a string.');
					}

				}

				return item;

			});

		return data;

	}
});
