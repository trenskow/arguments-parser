//
// plugins.js
// @trenskow/arguments-parser
//
// Created by Kristian Trenskow on 2028/08/04
// See license in LICENSE.
//

import {
	plugins
} from 'isvalid';

import autocomplete from './autocomplete.js';
import dummies from './dummies.js';
import hints from './hints.js';

export default () => {
	plugins.use('argumentsParser.dummies', dummies);
	plugins.use('argumentsParser.hints', hints);
	plugins.use('argumentsParser.autocomplete', autocomplete);
};
