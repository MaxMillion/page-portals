'use strict';

const { Item, SelectorContext } = require('sdk/context-menu');
const { Panel } = require('sdk/panel');
const { getMostRecentBrowserWindow } = require('sdk/window/utils');
const { URL } = require('sdk/url');

Item({
  label: "Portal",
  context: SelectorContext('a'),
  contentScript: 'self.on("click", function(node) self.postMessage({href: node.getAttribute("href"), location: (window.location + "")}));',
  onMessage: function({ href, location }) {
    let { width, height } = getWindowDetails();
    let panel = Panel({
      width: width - Math.round(width * .2),
      height: height - Math.round(height * .2),
      contentURL: URL(href, location)
    });
    panel.on('hide', panel.destroy);
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
