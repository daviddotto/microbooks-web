const docBody = document.querySelector('body')
const narrowMenuToggleButtons = document.querySelectorAll('a[aria-controls="narrow-menu-container"]')

const toggleNarrowMenu = (e) => {
  e.preventDefault()
  e.stopPropagation()
  const narrowMenuContainer = document.querySelector('#narrow-menu-container')
  const narrowMenuIsOpen = narrowMenuContainer.getAttribute('aria-expanded') === 'true'
  if (narrowMenuIsOpen) {
    narrowMenuToggleButtons.forEach(button => button.classList.remove('opened'))
    narrowMenuContainer.setAttribute('aria-expanded', 'false')
  } else {
    narrowMenuToggleButtons.forEach(button => button.classList.add('opened'))
    narrowMenuContainer.setAttribute('aria-expanded', 'true')
  }
}

const setHeaderHeight = () => {
  const headerHeight = document.querySelector('header#site-header').offsetHeight
  docBody.style.setProperty('--headerHeight', `${headerHeight}px`)
}

const setPageScrollingStatus = () => {
  if (window.scrollY > 1) {
    document.body.classList.add('scrolling')
  } else {
    document.body.classList.remove('scrolling')
  }
}

setHeaderHeight()
setPageScrollingStatus()

window.addEventListener('resize', setHeaderHeight)
window.addEventListener('scroll', setPageScrollingStatus)
narrowMenuToggleButtons.forEach(button => button.addEventListener('click', toggleNarrowMenu))
