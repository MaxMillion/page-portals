'use strict';

function closest(node, selector) {
  while (node && !node.mozMatchesSelector(selector))
    node = node.parentNode.mozMatchesSelector && node.parentNode;
  return node;
}

window.document.body.addEventListener('click', event => {
  let { target, metaKey, ctrlKey, shiftKey, altKey, button } = event;
  let isLeftClick = button === 0;

  if (isLeftClick && altKey && !shiftKey && !metaKey && !ctrlKey) {
    let link = closest(target, 'a');
    if (!link) {
      let url = (window.location + "");
      self.port.emit('switch', { href: url, location: url });
    }
  }
}, false);
