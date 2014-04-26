/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
'use strict';

const { Item, SelectorContext } = require('sdk/context-menu');
const { Panel } = require('sdk/panel');
const { getContentFrame } = require('sdk/panel/utils');
const { getActiveView } = require('sdk/view/core');
const { getMostRecentBrowserWindow } = require('sdk/window/utils');
const { URL } = require('sdk/url');
const { prefs } = require('sdk/simple-prefs');

Item({
  label: "Portal",
  context: SelectorContext('a'),
  contentScript: 'self.on("click", a => self.postMessage({ href: a.href, location: (window.location + "") }));',
  onMessage: ({ href, location }) => {
    let padding = prefs['portal-padding'];
    let { width, height } = getWindowDetails();
    let panel = Panel({
      width: Math.round(width - (padding * 2)),
      height: Math.round(height - 50 - (padding * 2)),
      contentURL: URL(href, location)
    });
    panel.on('hide', panel.destroy);
    panel.on('show', _ => {
      let window = getContentFrame(getActiveView(panel)).contentWindow;
      if (!window.document.hasFocus()) {
        window.focus()
      }
    });
    panel.show();
  }
});

function getWindowDetails(window) {
  window = window || getMostRecentBrowserWindow();
  return {
    width: window.innerWidth,
    height: window.innerHeight
  };
}
