/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
'use strict';

const { Cc, Ci } = require('chrome');
const { Item, SelectorContext } = require('sdk/context-menu');
const { Panel } = require('sdk/panel');
const { getContentFrame } = require('sdk/panel/utils');
const { getActiveView, viewFor } = require('sdk/view/core');
const tabs = require('sdk/tabs');
const { getTabContentWindow } = require('sdk/tabs/utils');
const { getMostRecentBrowserWindow } = require('sdk/window/utils');
const { URL } = require('sdk/url');
const { newURI } = require('sdk/url/utils');
const { prefs } = require('sdk/simple-prefs');
const { PageMod } = require('sdk/page-mod');
const { data } = require('sdk/self');

const asyncHistory = Cc["@mozilla.org/browser/history;1"].getService(Ci.mozIAsyncHistory);

const portalMap = new WeakMap();

let pagemod = PageMod({
  include: [ '*' ],
  attachTo: [ 'existing', 'top', 'frame' ],
  contentScriptWhen: 'ready',
  contentScriptFile: data.url('modifier.js'),
  onAttach: mod => {
    mod.port.on('click', activatePortal);
  }
});

Item({
  label: "Portal",
  context: SelectorContext('a'),
  contentScript: 'self.on("click", a => self.postMessage({ href: a.href, location: (window.location + "") }));',
  onMessage: activatePortal
});

function activatePortal({ href, location }) {
  let tab = tabs.activeTab;
  let padding = prefs['portal-padding'];
  let url = URL(href, location).toString();
  let { width, height } = getWindowDetails();
  let panel = Panel({
    width: Math.round(width - (padding * 2)),
    height: Math.round(height - 50 - (padding * 2)),
    contentURL: url,
    focus: true
  });

  portalMap.set(tab, panel);

  panel.on('hide', _ => {
    getTabContentWindow(viewFor(tab)).focus();
  });

  // hack for focus
  panel.on('show', _ => {
    let panelEle = getActiveView(panel);
    let window = getContentFrame(panelEle).contentWindow;
    if (!window.document.hasFocus()) {
      window.focus()
    }
    panelEle.setAttribute('consumeoutsideclicks', 'true');
    getContentFrame(panelEle).setAttribute('showcaret', 'false');
    function destroy() {
      portalMap.delete(tab);
      panel.destroy();
      tab.removeListener('deactivate', deactivate);
    }
    function deactivate() {
      tab.removeListener('deactivate', deactivate);
      panel.off('hide', destroy);
      panel.hide();
    }
    tab.on('deactivate', deactivate);
    panel.on('hide', destroy);
  });

  // hack for history
  panel.once('show', _ => {
    let window = getContentFrame(getActiveView(panel)).contentWindow;
    addHistory({
      uri: newURI(url),
      title: window.document.title,
      visits: [{
        visitDate: Date.now() * 1000,
        transitionType: Ci.nsINavHistoryService.TRANSITION_LINK
      }]
    });
  });

  panel.show();
}

tabs.on('activate', tab => {
  if (portalMap.has(tab)) {
    let panel = portalMap.get(tab);
    panel.show();
  }
});

function addHistory(place) {
  asyncHistory.updatePlaces(place, {
    handleError: function() {},
    handleResult: function() {},
    handleCompletion: function() {
    }
  });
}

function getWindowDetails(window) {
  window = window || getMostRecentBrowserWindow();
  return {
    width: window.innerWidth,
    height: window.innerHeight
  };
}
