"use strict";

var docBody = document.querySelector('body');
var narrowMenuToggleButtons = document.querySelectorAll('a[aria-controls="narrow-menu-container"]');
var toggleNarrowMenu = function toggleNarrowMenu(e) {
  e.preventDefault();
  e.stopPropagation();
  var narrowMenuContainer = document.querySelector('#narrow-menu-container');
  var narrowMenuIsOpen = narrowMenuContainer.getAttribute('aria-expanded') === 'true';
  if (narrowMenuIsOpen) {
    narrowMenuToggleButtons.forEach(function (button) {
      return button.classList.remove('opened');
    });
    narrowMenuContainer.setAttribute('aria-expanded', 'false');
  } else {
    narrowMenuToggleButtons.forEach(function (button) {
      return button.classList.add('opened');
    });
    narrowMenuContainer.setAttribute('aria-expanded', 'true');
  }
};
var setHeaderHeight = function setHeaderHeight() {
  var headerHeight = document.querySelector('header#site-header').offsetHeight;
  docBody.style.setProperty('--headerHeight', "".concat(headerHeight, "px"));
};
var setPageScrollingStatus = function setPageScrollingStatus() {
  if (window.scrollY > 1) {
    document.body.classList.add('scrolling');
  } else {
    document.body.classList.remove('scrolling');
  }
};
setHeaderHeight();
setPageScrollingStatus();
window.addEventListener('resize', setHeaderHeight);
window.addEventListener('scroll', setPageScrollingStatus);
narrowMenuToggleButtons.forEach(function (button) {
  return button.addEventListener('click', toggleNarrowMenu);
});
"use strict";

/* global $ */
$('body').on('submit', 'form', function () {
  // On form submit, add hidden inputs for checkboxes so the server knows if
  // they've been unchecked. This means we can automatically store and update
  // all form data on the server, including checkboxes that are checked, then
  // later unchecked

  var $checkboxes = $(this).find('input:checkbox');
  var $inputs = [];
  var names = {};
  $checkboxes.each(function () {
    var $this = $(this);
    if (!names[$this.attr('name')]) {
      names[$this.attr('name')] = true;
      var $input = $('<input type="hidden">');
      $input.attr('name', $this.attr('name'));
      $input.attr('value', '_unchecked');
      $inputs.push($input);
    }
  });
  $(this).prepend($inputs);
});
//# sourceMappingURL=app.js.map
