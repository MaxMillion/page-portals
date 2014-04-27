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
const { ToggleButton } = require('sdk/ui');

const asyncHistory = Cc["@mozilla.org/browser/history;1"].getService(Ci.mozIAsyncHistory);

const portalMap = new WeakMap();
const portalShowing = new WeakMap();

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

let button = ToggleButton({
  id: "portal-button",
  label: "Portal",
  icon: {
    "16": "./icon16.png",
    "32": "./icon32.png",
    "64": "./icon64.png"
  },
  onClick: function(state) {
    let tab = tabs.activeTab;
    let hasPortal = portalMap.has(tab)
    if (hasPortal) {
      button.state('tab', { checked: !button.state('tab').checked })
    }
  },
  onChange: function(state) {
    let tab = tabs.activeTab;
    let hasPortal = portalMap.has(tab);
    if (button.state('tab').checked) {
      if (hasPortal) {
        portalMap.get(tab).show();
      }
      else {
        button.state('tab', { checked: false })
      }
    }
    else if (hasPortal) {
      portalMap.get(tab).hide();
    }
  }
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
    contentScriptFile: data.url('portal-modifier.js'),
    focus: true
  });

  if (portalMap.has(tab)) {
    portalMap.get(tab).destroy();
  }
  portalMap.set(tab, panel);

  panel.on('hide', _ => {
    getTabContentWindow(viewFor(tab)).focus();
    button.state(tab, { checked: false });
  });

  // hack for focus
  panel.on('show', _ => {
    let panelEle = getActiveView(panel);
    button.state(tab, { checked: true });
    portalShowing.set(panel, true);
    let window = getContentFrame(panelEle).contentWindow;
    if (!window.document.hasFocus()) {
      window.focus()
    }
    panelEle.setAttribute('consumeoutsideclicks', 'true');
    getContentFrame(panelEle).setAttribute('showcaret', 'false');
    function destroy() {
      tab.removeListener('deactivate', deactivate);
      portalShowing.delete(panel);
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

  panel.port.on('switch', ({ href }) => {
    tabs.activeTab.url = href;
    panel.hide();
  });

  panel.show();
}

tabs.on('activate', tab => {
  if (portalMap.has(tab)) {
    let portal = portalMap.get(tab);
    if (portalShowing.get(portal)) {
      portal.show();
    }
  }
});

tabs.on('close', tab => {
  if (portalMap.has(tab)) {
    let portal = portalMap.get(tab);
    portal.destroy();
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
