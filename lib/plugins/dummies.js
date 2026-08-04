//
// dummies.js
// @trenskow/arguments-parser
//
// Created by Kristian Trenskow on 2028/08/04
// See license in LICENSE.
//

export default () => ({
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
});
