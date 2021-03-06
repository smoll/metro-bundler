/**
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @format
 */
'use strict';

// Bug with Jest because we're going to the node_modules that is a sibling
// of what jest thinks our root (the dir with the package.json) should be.
module.exports = require.requireActual('lodash');
