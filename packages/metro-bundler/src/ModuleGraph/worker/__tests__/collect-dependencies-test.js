/**
 * Copyright (c) 2017-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @format
 * @emails oncall+javascript_foundation
 */

'use strict';

const collectDependencies = require('../collect-dependencies');
const astFromCode = require('babylon').parse;
const {codeFromAst, comparableCode} = require('../../test-helpers');

const {any} = expect;

const {InvalidRequireCallError} = collectDependencies;

describe('dependency collection from ASTs:', () => {
  it('collects dependency identifiers from the code', () => {
    const ast = astFromCode(`
      const a = require('b/lib/a');
      exports.do = () => require("do");
      if (!something) {
        require("setup/something");
      }
    `);

    expect(collectDependencies(ast).dependencies).toEqual([
      'b/lib/a',
      'do',
      'setup/something',
    ]);
  });

  it('collects asynchronous dependencies', () => {
    const ast = astFromCode(`
      const a = require('b/lib/a');
      if (!something) {
        require.async("some/async/module").then(foo => {});
      }
    `);

    expect(collectDependencies(ast).dependencies).toEqual([
      'b/lib/a',
      'some/async/module',
    ]);
  });

  it('supports template literals as arguments', () => {
    const ast = astFromCode('require(`left-pad`)');

    expect(collectDependencies(ast).dependencies).toEqual(['left-pad']);
  });

  it('throws on template literals with interpolations', () => {
    const ast = astFromCode('require(`left${"-"}pad`)');

    expect(() => collectDependencies(ast).dependencies).toThrowError(
      InvalidRequireCallError,
    );
  });

  it('throws on tagged template literals', () => {
    const ast = astFromCode('require(tag`left-pad`)');

    expect(() => collectDependencies(ast).dependencies).toThrowError(
      InvalidRequireCallError,
    );
  });

  it('exposes a string as `dependencyMapName`', () => {
    const ast = astFromCode('require("arbitrary")');
    expect(collectDependencies(ast).dependencyMapName).toEqual(any(String));
  });

  it('exposes a string as `dependencyMapName` even without collecting dependencies', () => {
    const ast = astFromCode('');
    expect(collectDependencies(ast).dependencyMapName).toEqual(any(String));
  });

  it('replaces all required module ID strings with array lookups, keeps the ID as second argument', () => {
    const ast = astFromCode(`
        const a = require('b/lib/a');
        exports.do = () => require("do");
        if (!something) {
          require("setup/something");
        }
      `);

    const {dependencyMapName} = collectDependencies(ast);

    expect(codeFromAst(ast)).toEqual(
      comparableCode(`
        const a = require(${dependencyMapName}[0], 'b/lib/a');
        exports.do = () => require(${dependencyMapName}[1], "do");
        if (!something) {
          require(${dependencyMapName}[2], "setup/something");
        }
      `),
    );
  });
});

describe('Dependency collection from optimized ASTs:', () => {
  const dependencyMapName = 'arbitrary';
  const {forOptimization} = collectDependencies;
  let ast, names;

  beforeEach(() => {
    ast = astFromCode(`
      const a = require(${dependencyMapName}[0], 'b/lib/a');
      exports.do = () => require(${dependencyMapName}[1], "do");
      require.async(${dependencyMapName}[2], 'some/async/module').then(foo => {});
      if (!something) {
        require(${dependencyMapName}[3], "setup/something");
      }
    `);
    names = ['b/lib/a', 'do', 'some/async/module', 'setup/something'];
  });

  it('passes the `dependencyMapName` through', () => {
    const result = forOptimization(ast, names, dependencyMapName);
    expect(result.dependencyMapName).toEqual(dependencyMapName);
  });

  it('returns the list of passed in dependencies', () => {
    const result = forOptimization(ast, names, dependencyMapName);
    expect(result.dependencies).toEqual(names);
  });

  it('only returns dependencies that are in the code', () => {
    ast = astFromCode(`require(${dependencyMapName}[1], 'do')`);
    const result = forOptimization(ast, names, dependencyMapName);
    expect(result.dependencies).toEqual(['do']);
  });

  it('replaces all call signatures inserted by a prior call to `collectDependencies`', () => {
    forOptimization(ast, names, dependencyMapName);
    expect(codeFromAst(ast)).toEqual(
      comparableCode(`
      const a = require(${dependencyMapName}[0]);
      exports.do = () => require(${dependencyMapName}[1]);
      require.async(${dependencyMapName}[2]).then(foo => {});
      if (!something) {
        require(${dependencyMapName}[3]);
      }
    `),
    );
  });
});
