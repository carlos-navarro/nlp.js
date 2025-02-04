/*
 * Copyright (c) AXA Group Operations Spain S.A.
 *
 * Permission is hereby granted, free of charge, to any person obtaining
 * a copy of this software and associated documentation files (the
 * "Software"), to deal in the Software without restriction, including
 * without limitation the rights to use, copy, modify, merge, publish,
 * distribute, sublicense, and/or sell copies of the Software, and to
 * permit persons to whom the Software is furnished to do so, subject to
 * the following conditions:
 *
 * The above copyright notice and this permission notice shall be
 * included in all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
 * EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
 * MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
 * NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE
 * LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION
 * OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION
 * WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 */

const fs = require('fs');
const path = require('path');
const containerBootstrap = require('./container-bootstrap');

class Dock {
  constructor() {
    this.containers = {};
  }

  getContainer(name) {
    return this.containers[name || 'default'];
  }

  async createContainer(
    name,
    settings,
    mustLoadEnv = true,
    preffix,
    parent,
    pipelines
  ) {
    if (typeof name !== 'string') {
      settings = name;
      name = '';
    }
    if (!settings) {
      if (name === 'default' || name === '') {
        settings = 'conf.json';
      } else {
        settings = path.join(name, 'conf.json');
        if (!fs.existsSync(settings)) {
          settings = `${name}_conf.json`;
        }
      }
    }
    if (!this.containers[name]) {
      const container = containerBootstrap(
        settings,
        mustLoadEnv,
        undefined,
        preffix,
        pipelines
      );
      container.name = name;
      this.containers[name] = container;
      container.dock = this;
      container.parent = parent;
      await container.start();
      if (container.childs) {
        await this.buildChilds(container);
      }
    }
    return this.containers[name];
  }

  async buildChilds(container) {
    if (container && container.childs) {
      const keys = Object.keys(container.childs);
      const childs = {};
      for (let i = 0; i < keys.length; i += 1) {
        const settings = container.childs[keys[i]];
        settings.isChild = true;
        if (!settings.pathPipeline) {
          settings.pathPipeline = `${keys[i]}_pipeline.md`;
        }
        childs[keys[i]] = await this.createContainer(
          keys[i],
          settings,
          false,
          keys[i],
          container,
          container.childPipelines
            ? container.childPipelines[keys[i]]
            : undefined
        );
      }
      container.childs = childs;
    }
  }

  async terraform(settings, mustLoadEnv = true) {
    const defaultContainer = await this.createContainer(
      'default',
      settings,
      mustLoadEnv,
      ''
    );
    return defaultContainer;
  }

  start(settings, mustLoadEnv = true) {
    return this.terraform(settings, mustLoadEnv);
  }
}

const dock = new Dock();

module.exports = dock;
