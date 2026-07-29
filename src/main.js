import './style.css'

const assetBase = import.meta.env.BASE_URL
const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

function getHeaderOffset() {
  return window.matchMedia('(max-width: 768px)').matches ? 72 : 80
}

function normalizePath(pathname) {
  if (!pathname) return '/'
  if (pathname.length > 1 && pathname.endsWith('/')) return pathname.slice(0, -1)
  return pathname
}

function pageKey(pathname) {
  let path = normalizePath(pathname).toLowerCase()
  if (path.endsWith('.html')) path = path.slice(0, -5)
  if (path.endsWith('/index')) path = path.slice(0, -6) || '/'
  return path || '/'
}

function scrollBehavior(preferSmooth = true) {
  if (prefersReducedMotion || !preferSmooth) return 'auto'
  return 'smooth'
}

function scrollToElementId(id, { behavior, focus = false } = {}) {
  if (!id) return false
  let target = null
  try {
    target = document.getElementById(id) || document.querySelector(`#${CSS.escape(id)}`)
  } catch {
    target = document.getElementById(id)
  }
  if (!target) return false
  const top = Math.max(0, target.getBoundingClientRect().top + window.scrollY - getHeaderOffset())
  window.scrollTo({ top, behavior: behavior ?? scrollBehavior(true) })
  if (focus) {
    if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1')
    try {
      target.focus({ preventScroll: true })
    } catch {
      target.focus()
    }
  }
  return true
}

function scrollToLocationHash({ behavior } = {}) {
  if (!location.hash || location.hash === '#') return false
  const id = decodeURIComponent(location.hash.slice(1))
  return scrollToElementId(id, { behavior: behavior ?? 'auto' })
}

function sameDocumentUrl(url) {
  return url.origin === location.origin && pageKey(url.pathname) === pageKey(location.pathname)
}

// Thin sitewide reading progress bar (decorative — not announced)
function initScrollProgress() {
  if (document.querySelector('.scroll-progress')) return

  const track = document.createElement('div')
  track.className = 'scroll-progress'
  track.setAttribute('aria-hidden', 'true')
  track.innerHTML = '<div class="scroll-progress-bar"></div>'

  const skip = document.querySelector('.skip-link')
  if (skip?.nextSibling) {
    skip.parentNode.insertBefore(track, skip.nextSibling)
  } else {
    document.body.prepend(track)
  }

  const bar = track.querySelector('.scroll-progress-bar')
  let frame = 0

  const update = () => {
    frame = 0
    const root = document.documentElement
    const max = root.scrollHeight - root.clientHeight
    const pct = max > 0 ? Math.min(100, Math.max(0, (window.scrollY / max) * 100)) : 0
    bar.style.transform = `scaleX(${pct / 100})`
    track.classList.toggle('is-complete', pct >= 99.5)
  }

  const onScrollOrResize = () => {
    if (frame) return
    frame = requestAnimationFrame(update)
  }

  window.addEventListener('scroll', onScrollOrResize, { passive: true })
  window.addEventListener('resize', onScrollOrResize)
  update()
}

// Hash / scroll history: sticky-header offsets, pushState, back/forward
function initScrollHistory() {
  const hasHashOnLoad = Boolean(location.hash && location.hash !== '#')
  const storageKey = `pf:scroll:${pageKey(location.pathname)}`

  if ('scrollRestoration' in history) {
    history.scrollRestoration = 'manual'
  }

  const readStoredScroll = () => {
    try {
      const raw = sessionStorage.getItem(storageKey)
      if (raw == null) return null
      const y = Number(raw)
      return Number.isFinite(y) ? y : null
    } catch {
      return null
    }
  }

  const persistPageScroll = (y = window.scrollY) => {
    try {
      sessionStorage.setItem(storageKey, String(Math.round(y)))
    } catch {
      /* ignore */
    }
  }

  const persistHistoryScroll = (y = window.scrollY) => {
    try {
      history.replaceState({ ...(history.state || {}), scrollY: Math.round(y) }, '', location.href)
    } catch {
      /* ignore */
    }
  }

  persistHistoryScroll(window.scrollY)

  let rememberTimer = 0
  window.addEventListener('scroll', () => {
    window.clearTimeout(rememberTimer)
    rememberTimer = window.setTimeout(() => {
      persistPageScroll()
      // Only stamp the current history entry while it has no hash target,
      // so in-page back can restore the pre-hash position.
      if (!location.hash || location.hash === '#') {
        persistHistoryScroll()
      }
    }, 100)
  }, { passive: true })

  window.addEventListener('pagehide', () => persistPageScroll())
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') persistPageScroll()
  })

  document.addEventListener('click', (e) => {
    const anchor = e.target.closest('a[href]')
    if (!anchor || anchor.target === '_blank' || e.defaultPrevented) return
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return

    const href = anchor.getAttribute('href')
    if (!href || href === '#') return

    let url
    try {
      url = new URL(href, location.href)
    } catch {
      return
    }

    if (!url.hash || url.hash === '#') return
    if (!sameDocumentUrl(url)) return

    const id = decodeURIComponent(url.hash.slice(1))
    if (!document.getElementById(id)) return

    e.preventDefault()

    const preHashY = Math.round(window.scrollY)
    persistPageScroll(preHashY)
    persistHistoryScroll(preHashY)

    const nextUrl = `${location.pathname}${location.search}${url.hash}`
    if (location.hash !== url.hash) {
      history.pushState({ scrollTo: id }, '', nextUrl)
    } else {
      history.replaceState({ ...(history.state || {}), scrollTo: id }, '', nextUrl)
    }

    scrollToElementId(id, { behavior: scrollBehavior(true), focus: true })
  })

  window.addEventListener('popstate', (event) => {
    if (location.hash && location.hash !== '#') {
      scrollToLocationHash({ behavior: 'auto' })
      return
    }

    const fromState = typeof event.state?.scrollY === 'number' ? event.state.scrollY : null
    const y = fromState ?? readStoredScroll() ?? 0
    window.scrollTo({ top: y, behavior: 'auto' })
  })

  window.addEventListener('hashchange', () => {
    if (location.hash && location.hash !== '#') {
      scrollToLocationHash({ behavior: scrollBehavior(true) })
    }
  })

  if (hasHashOnLoad) {
    const lockHashScroll = () => scrollToLocationHash({ behavior: 'auto' })
    lockHashScroll()
    requestAnimationFrame(() => {
      lockHashScroll()
      requestAnimationFrame(lockHashScroll)
    })
    window.addEventListener('load', lockHashScroll, { once: true })
    window.setTimeout(lockHashScroll, 120)
    window.setTimeout(lockHashScroll, 400)
    return
  }

  const nav = performance.getEntriesByType?.('navigation')?.[0]
  if (nav?.type === 'back_forward' || nav?.type === 'reload') {
    const y = readStoredScroll()
    if (y != null) window.scrollTo({ top: y, behavior: 'auto' })
  }
}

initScrollProgress()
initScrollHistory()

// Skip link + main landmark focus
const mainContent = document.getElementById('main-content')
if (mainContent && !mainContent.hasAttribute('tabindex')) {
  mainContent.setAttribute('tabindex', '-1')
}

document.querySelectorAll('a.skip-link[href="#main-content"]').forEach((link) => {
  link.addEventListener('click', (e) => {
    e.preventDefault()
    scrollToElementId('main-content', { behavior: scrollBehavior(true), focus: true })
    history.replaceState({ ...(history.state || {}), scrollY: window.scrollY }, '', `${location.pathname}${location.search}#main-content`)
  })
})

// Mobile navigation: focus trap, Escape, inert backdrop
const navToggle = document.querySelector('.nav-toggle')
const navMenu = document.querySelector('.nav-menu')

if (navToggle && navMenu) {
  if (!navMenu.querySelector('.nav-menu-cta')) {
    const ctaItem = document.createElement('li')
    ctaItem.className = 'nav-menu-cta'
    ctaItem.innerHTML = `<a href="${assetBase}contact/" class="btn btn-primary">Book a Consultation</a>`
    navMenu.appendChild(ctaItem)
  }

  const focusableSelector = 'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])'
  let lastFocusedBeforeNav = null

  const getFocusableInMenu = () =>
    Array.from(navMenu.querySelectorAll(focusableSelector)).filter(
      (el) => !el.hasAttribute('disabled') && el.offsetParent !== null,
    )

  const setInertBackground = (inert) => {
    document.querySelectorAll('main, footer, .skip-link').forEach((el) => {
      if (inert) el.setAttribute('inert', '')
      else el.removeAttribute('inert')
    })
  }

  const openNav = () => {
    lastFocusedBeforeNav = document.activeElement
    navToggle.classList.add('active')
    navMenu.classList.add('active')
    navToggle.setAttribute('aria-expanded', 'true')
    navToggle.setAttribute('aria-label', 'Close navigation menu')
    document.body.classList.add('nav-open')
    setInertBackground(true)
    const focusables = getFocusableInMenu()
    ;(focusables[0] || navMenu).focus()
  }

  const closeNav = ({ restoreFocus = true } = {}) => {
    navToggle.classList.remove('active')
    navMenu.classList.remove('active')
    navToggle.setAttribute('aria-expanded', 'false')
    navToggle.setAttribute('aria-label', 'Open navigation menu')
    document.body.classList.remove('nav-open')
    setInertBackground(false)
    navMenu.querySelectorAll('.nav-item--has-dropdown.is-open').forEach((item) => {
      item.classList.remove('is-open')
      const btn = item.querySelector('.nav-dropdown-toggle')
      if (btn) {
        btn.setAttribute('aria-expanded', 'false')
        btn.setAttribute('aria-label', 'Show services menu')
      }
    })
    if (restoreFocus) {
      const target = lastFocusedBeforeNav || navToggle
      try {
        target.focus({ preventScroll: true })
      } catch {
        target.focus()
      }
    }
  }

  navToggle.addEventListener('click', () => {
    if (navMenu.classList.contains('active')) closeNav()
    else openNav()
  })

  navMenu.querySelectorAll('a').forEach((link) => {
    link.addEventListener('click', () => closeNav({ restoreFocus: false }))
  })

  document.addEventListener('keydown', (e) => {
    if (!navMenu.classList.contains('active')) return

    if (e.key === 'Escape') {
      e.preventDefault()
      closeNav()
      return
    }

    if (e.key !== 'Tab') return
    const focusables = getFocusableInMenu()
    if (!focusables.length) return
    const first = focusables[0]
    const last = focusables[focusables.length - 1]
    const active = document.activeElement

    if (e.shiftKey && (active === first || active === navToggle)) {
      e.preventDefault()
      last.focus()
    } else if (!e.shiftKey && active === last) {
      e.preventDefault()
      first.focus()
    } else if (!e.shiftKey && active === navToggle) {
      e.preventDefault()
      first.focus()
    }
  })

  window.addEventListener('resize', () => {
    if (window.matchMedia('(min-width: 769px)').matches && navMenu.classList.contains('active')) {
      closeNav({ restoreFocus: false })
    }
  })
}

// Services navbar dropdown
document.querySelectorAll('.nav-item--has-dropdown').forEach((item) => {
  const toggle = item.querySelector('.nav-dropdown-toggle')
  const menu = item.querySelector('.nav-dropdown')
  if (!toggle || !menu) return

  const setOpen = (open) => {
    item.classList.toggle('is-open', open)
    toggle.setAttribute('aria-expanded', String(open))
    toggle.setAttribute('aria-label', open ? 'Hide services menu' : 'Show services menu')
  }

  toggle.addEventListener('click', (e) => {
    e.preventDefault()
    e.stopPropagation()
    const willOpen = !item.classList.contains('is-open')
    document.querySelectorAll('.nav-item--has-dropdown.is-open').forEach((other) => {
      if (other !== item) {
        other.classList.remove('is-open')
        const otherBtn = other.querySelector('.nav-dropdown-toggle')
        if (otherBtn) {
          otherBtn.setAttribute('aria-expanded', 'false')
          otherBtn.setAttribute('aria-label', 'Show services menu')
        }
      }
    })
    setOpen(willOpen)
  })

  document.addEventListener('click', (e) => {
    if (!item.contains(e.target)) setOpen(false)
  })

  item.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && item.classList.contains('is-open')) {
      e.stopPropagation()
      setOpen(false)
      toggle.focus()
    }
  })
})

// Contact form handling
const contactForm = document.querySelector('.contact-form')

if (contactForm) {
  const statusEl = document.querySelector('.form-status')

  const ensureFieldErrorEl = (field) => {
    const id = `${field.id || field.name}-error`
    let errorEl = document.getElementById(id)
    if (!errorEl) {
      errorEl = document.createElement('p')
      errorEl.id = id
      errorEl.className = 'field-error'
      errorEl.hidden = true
      const parent = field.closest('.form-group') || field.parentElement
      parent?.appendChild(errorEl)
    }
    return errorEl
  }

  const clearFieldError = (field) => {
    field.classList.remove('error')
    field.removeAttribute('aria-invalid')
    const describedby = field.getAttribute('aria-describedby')
    const errorId = `${field.id || field.name}-error`
    if (describedby) {
      field.setAttribute(
        'aria-describedby',
        describedby.split(/\s+/).filter((id) => id && id !== errorId).join(' ') || null,
      )
      if (!field.getAttribute('aria-describedby')) field.removeAttribute('aria-describedby')
    }
    const errorEl = document.getElementById(errorId)
    if (errorEl) {
      errorEl.hidden = true
      errorEl.textContent = ''
    }
  }

  const markFieldError = (field, message) => {
    field.classList.add('error')
    field.setAttribute('aria-invalid', 'true')
    const errorEl = ensureFieldErrorEl(field)
    errorEl.hidden = false
    errorEl.textContent = message
    const errorId = errorEl.id
    const existing = (field.getAttribute('aria-describedby') || '')
      .split(/\s+/)
      .filter(Boolean)
    if (!existing.includes(errorId)) {
      field.setAttribute('aria-describedby', [...existing, errorId].join(' '))
    }
  }

  contactForm.querySelectorAll('input, textarea, select').forEach((field) => {
    const eventName = field.type === 'checkbox' || field.tagName === 'SELECT' ? 'change' : 'input'
    field.addEventListener(eventName, () => clearFieldError(field))
  })

  contactForm.addEventListener('submit', async function (e) {
    e.preventDefault()

    const submitBtn = contactForm.querySelector('button[type="submit"]')
    const originalText = submitBtn.textContent

    const requiredFields = contactForm.querySelectorAll('[required]')
    let isValid = true
    let firstInvalid = null

    requiredFields.forEach((field) => {
      const empty = field.type === 'checkbox' ? !field.checked : !field.value.trim()
      if (empty) {
        isValid = false
        const label = field.type === 'checkbox'
          ? 'Please accept the privacy and terms consent.'
          : 'This field is required.'
        markFieldError(field, label)
        if (!firstInvalid) firstInvalid = field
      } else {
        clearFieldError(field)
      }
    })

    if (!isValid) {
      showStatus(statusEl, 'Please fill in all required fields.', 'error')
      firstInvalid?.focus()
      return
    }

    const emailField = contactForm.querySelector('#email')
    if (emailField && !isValidEmail(emailField.value)) {
      markFieldError(emailField, 'Please enter a valid email address.')
      showStatus(statusEl, 'Please enter a valid email address.', 'error')
      emailField.focus()
      return
    }

    submitBtn.disabled = true
    submitBtn.textContent = 'Sending...'

    try {
      await simulateFormSubmission(new FormData(contactForm))
      showStatus(statusEl, 'Thank you. Your message has been received and we will respond within one business day.', 'success')
      contactForm.reset()
      contactForm.querySelectorAll('[aria-invalid]').forEach(clearFieldError)
    } catch {
      showStatus(statusEl, 'Something went wrong. Please email us directly or try again later.', 'error')
    } finally {
      submitBtn.disabled = false
      submitBtn.textContent = originalText
    }
  })
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

function showStatus(element, message, type) {
  if (!element) return
  element.textContent = message
  element.className = `form-status ${type}`
  element.setAttribute('role', 'status')
  element.setAttribute('aria-live', type === 'error' ? 'assertive' : 'polite')
  element.scrollIntoView({ behavior: scrollBehavior(true), block: 'nearest' })
}

function simulateFormSubmission(formData) {
  return new Promise((resolve) => {
    setTimeout(() => {
      // eslint-disable-next-line no-console
      console.log('Form data (replace with real submission):', Object.fromEntries(formData))
      resolve()
    }, 1200)
  })
}

function scheduleIdle(fn, timeout = 1800) {
  if (typeof requestIdleCallback === 'function') {
    requestIdleCallback(() => fn(), { timeout })
  } else {
    setTimeout(fn, 1)
  }
}

// Lazy-activate fixed parallax photos when near viewport
document.querySelectorAll('.section-parallax').forEach((section) => {
  if (!('IntersectionObserver' in window)) {
    section.classList.add('is-media-ready')
    return
  }
  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return
        section.classList.add('is-media-ready')
        io.disconnect()
      })
    },
    { rootMargin: '200px 0px', threshold: 0.01 },
  )
  io.observe(section)
})

scheduleIdle(() => {
// Scroll reveal with reduced-motion support
const revealElements = document.querySelectorAll(
  '.service-card, .stat-card, .team-card, .value-card, .contact-method-card, .reach-card, .faq-item',
)

function applyEnterStagger(selector, stepMs = 110, baseMs = 40) {
  document.querySelectorAll(selector).forEach((grid) => {
    const cards = grid.querySelectorAll(
      '.team-card, .stat-card, .value-card, .reach-card, .expertise-card, .faq-item',
    )
    cards.forEach((card, i) => {
      card.style.setProperty('--enter-delay', `${baseMs + i * stepMs}ms`)
    })
  })
}

applyEnterStagger('.team-showcase', 140, 60)
applyEnterStagger('.stats-grid', 100, 40)
applyEnterStagger('.values-grid', 110, 50)
applyEnterStagger('.reach-grid', 160, 80)
applyEnterStagger('.expertise-grid', 130, 50)
applyEnterStagger('.faq-list', 80, 40)

const leadershipSection = document.querySelector('.section-leadership')
if (leadershipSection) {
  if (prefersReducedMotion || !('IntersectionObserver' in window)) {
    leadershipSection.classList.add('is-inview')
  } else {
    const leadershipObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return
          leadershipSection.classList.add('is-inview')
          leadershipObserver.unobserve(leadershipSection)
        })
      },
      { threshold: 0.2 }
    )
    leadershipObserver.observe(leadershipSection)
  }
}

const homeAboutSection = document.querySelector('.section-home-about')
if (homeAboutSection) {
  if (prefersReducedMotion || !('IntersectionObserver' in window)) {
    homeAboutSection.classList.add('is-inview')
  } else {
    const homeAboutObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return
          homeAboutSection.classList.add('is-inview')
          homeAboutObserver.unobserve(homeAboutSection)
        })
      },
      { threshold: 0.22 }
    )
    homeAboutObserver.observe(homeAboutSection)
  }
}

if (!prefersReducedMotion && 'IntersectionObserver' in window) {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-revealed')
        observer.unobserve(entry.target)
      }
    })
  }, { threshold: 0.14, rootMargin: '0px 0px -6% 0px' })

  revealElements.forEach(el => {
    el.classList.add('reveal-on-scroll')
    observer.observe(el)
  })
} else if (prefersReducedMotion) {
  revealElements.forEach(el => el.classList.add('is-revealed'))
}

// Animated stat counters
function easeOutCubic(t) {
  return 1 - (1 - t) ** 3
}

function setStatValue(card, value) {
  const countEl = card.querySelector('.stat-count')
  if (countEl) countEl.textContent = String(Math.round(value))
}

function animateStatCard(card) {
  const target = Number(card.dataset.count)
  if (!Number.isFinite(target)) return

  const countEl = card.querySelector('.stat-count')
  if (!countEl) return

  if (prefersReducedMotion) {
    setStatValue(card, target)
    return
  }

  const duration = Number(card.dataset.duration) || 1400
  const start = performance.now()

  function frame(now) {
    const progress = Math.min((now - start) / duration, 1)
    setStatValue(card, target * easeOutCubic(progress))
    if (progress < 1) requestAnimationFrame(frame)
  }

  requestAnimationFrame(frame)
}

const statCards = document.querySelectorAll('.stat-card[data-count]')

statCards.forEach((card) => {
  const target = card.dataset.count
  const suffix = card.dataset.suffix || ''
  const label = card.querySelector('.stat-label')?.textContent?.trim() || ''
  card.setAttribute('aria-label', `${target}${suffix} ${label}`.trim())
})

if (statCards.length) {
  if (prefersReducedMotion || !('IntersectionObserver' in window)) {
    statCards.forEach((card) => setStatValue(card, Number(card.dataset.count)))
  } else {
    const counterObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return
          animateStatCard(entry.target)
          counterObserver.unobserve(entry.target)
        })
      },
      { threshold: 0.35 }
    )
    statCards.forEach((card) => counterObserver.observe(card))
  }
}

// Resources carousel + entrance animations (center-focus, infinite loop)
function initResourcesCarousel(root) {
  const track = root.querySelector('.resources-carousel-track')
  const viewport = root.querySelector('.resources-carousel-viewport')
  const prevBtn = root.querySelector('[data-carousel-prev]')
  const nextBtn = root.querySelector('[data-carousel-next]')
  const dotsWrap = root.querySelector('[data-carousel-dots]')
  if (!track || !viewport || !prevBtn || !nextBtn || !dotsWrap) return

  const originals = Array.from(track.querySelectorAll('[data-carousel-slide]'))
  const total = originals.length
  if (total < 2) return

  viewport.setAttribute('role', 'region')
  viewport.setAttribute('aria-roledescription', 'carousel')
  if (!viewport.getAttribute('aria-label')) {
    viewport.setAttribute('aria-label', 'Resource articles')
  }

  let liveRegion = root.querySelector('[data-carousel-live]')
  if (!liveRegion) {
    liveRegion = document.createElement('div')
    liveRegion.className = 'visually-hidden'
    liveRegion.setAttribute('data-carousel-live', '')
    liveRegion.setAttribute('aria-live', 'polite')
    liveRegion.setAttribute('aria-atomic', 'true')
    root.insertBefore(liveRegion, root.firstChild)
  }

  let pauseBtn = root.querySelector('[data-carousel-pause]')
  if (!pauseBtn) {
    pauseBtn = document.createElement('button')
    pauseBtn.type = 'button'
    pauseBtn.className = 'resources-carousel-pause'
    pauseBtn.setAttribute('data-carousel-pause', '')
    pauseBtn.setAttribute('aria-pressed', 'false')
    pauseBtn.textContent = 'Pause slideshow'
    const controls = root.querySelector('.resources-carousel-controls')
    if (controls) controls.appendChild(pauseBtn)
    else root.appendChild(pauseBtn)
  }

  dotsWrap.removeAttribute('role')
  dotsWrap.setAttribute('aria-label', 'Choose a resource slide')

  const cloneCount = Math.min(3, total)
  const frag = document.createDocumentFragment()

  const setSlideInert = (slide, inert) => {
    slide.setAttribute('aria-hidden', String(inert))
    slide.querySelectorAll('a, button, input, select, textarea').forEach((el) => {
      if (inert) {
        if (el.getAttribute('data-a11y-inert') === '1') return
        el.setAttribute('data-a11y-inert', '1')
        if (el.hasAttribute('tabindex')) el.dataset.prevTabindex = el.getAttribute('tabindex')
        el.setAttribute('tabindex', '-1')
      } else if (el.getAttribute('data-a11y-inert') === '1') {
        el.removeAttribute('data-a11y-inert')
        if (el.dataset.prevTabindex != null) {
          el.setAttribute('tabindex', el.dataset.prevTabindex)
          delete el.dataset.prevTabindex
        } else {
          el.removeAttribute('tabindex')
        }
      }
    })
  }

  for (let i = total - cloneCount; i < total; i += 1) {
    const clone = originals[i].cloneNode(true)
    clone.removeAttribute('id')
    clone.dataset.clone = 'true'
    setSlideInert(clone, true)
    frag.appendChild(clone)
  }
  originals.forEach((slide) => frag.appendChild(slide))
  for (let i = 0; i < cloneCount; i += 1) {
    const clone = originals[i].cloneNode(true)
    clone.removeAttribute('id')
    clone.dataset.clone = 'true'
    setSlideInert(clone, true)
    frag.appendChild(clone)
  }

  track.innerHTML = ''
  track.appendChild(frag)

  const slides = Array.from(track.children)
  let position = cloneCount
  let autoplayTimer = null
  let autoplayPaused = prefersReducedMotion
  let isAnimating = false
  let touchStartX = 0
  let touchDeltaX = 0

  originals.forEach((slide, i) => {
    slide.style.setProperty('--enter-delay', String(100 + i * 80))
  })

  function logicalIndex(pos = position) {
    const raw = (pos - cloneCount) % total
    return raw < 0 ? raw + total : raw
  }

  function announce() {
    const active = slides[position]
    const title = active?.querySelector('h3')?.textContent?.trim()
    if (title) liveRegion.textContent = `Showing ${logicalIndex() + 1} of ${total}: ${title}`
  }

  function rebuildDots() {
    dotsWrap.innerHTML = ''
    for (let i = 0; i < total; i += 1) {
      const dot = document.createElement('button')
      dot.type = 'button'
      dot.className = 'resources-carousel-dot'
      dot.setAttribute('aria-label', `Go to resource ${i + 1} of ${total}`)
      dot.setAttribute('aria-current', i === 0 ? 'true' : 'false')
      dot.addEventListener('click', () => {
        goTo(cloneCount + i)
        restartAutoplayIfAllowed()
      })
      dotsWrap.appendChild(dot)
    }
  }

  function measure() {
    const first = slides[0]
    const styles = getComputedStyle(track)
    const gap = parseFloat(styles.gap) || 22
    const slideWidth = first.getBoundingClientRect().width
    return { gap, slideWidth, viewportWidth: viewport.clientWidth }
  }

  function applyTransform(animate = true) {
    const { gap, slideWidth, viewportWidth } = measure()
    const offset = position * (slideWidth + gap) - (viewportWidth / 2 - slideWidth / 2)

    if (!animate || prefersReducedMotion) {
      track.classList.add('is-jumping')
    } else {
      track.classList.remove('is-jumping')
    }

    track.style.transform = `translate3d(${-offset}px, 0, 0)`

    if (!animate || prefersReducedMotion) {
      // eslint-disable-next-line no-unused-expressions
      track.offsetHeight
      track.classList.remove('is-jumping')
    }
  }

  function syncActive() {
    const activeLogical = logicalIndex()
    slides.forEach((slide, i) => {
      const isActive = i === position
      const isSide = Math.abs(i - position) === 1
      slide.classList.toggle('is-active', isActive)
      slide.classList.toggle('is-side', isSide)
      if (slide.dataset.clone) {
        setSlideInert(slide, true)
      } else {
        // Only the centered slide is interactive; sides remain visible but not tabbable
        setSlideInert(slide, !isActive)
      }
    })
    dotsWrap.querySelectorAll('.resources-carousel-dot').forEach((dot, i) => {
      const current = i === activeLogical
      dot.setAttribute('aria-current', String(current))
      dot.tabIndex = current ? 0 : -1
    })
    announce()
  }

  function normalizePosition() {
    let jumped = false
    if (position >= cloneCount + total) {
      position -= total
      jumped = true
    } else if (position < cloneCount) {
      position += total
      jumped = true
    }
    if (jumped) applyTransform(false)
    isAnimating = false
    syncActive()
  }

  function goTo(nextPos) {
    if (isAnimating) return
    isAnimating = true
    position = nextPos
    applyTransform(true)
    syncActive()
  }

  function next() {
    goTo(position + 1)
  }

  function prev() {
    goTo(position - 1)
  }

  function stopAutoplay() {
    if (autoplayTimer) {
      clearInterval(autoplayTimer)
      autoplayTimer = null
    }
  }

  function startAutoplay() {
    stopAutoplay()
    if (prefersReducedMotion || autoplayPaused) return
    autoplayTimer = setInterval(() => {
      if (document.hidden || isAnimating) return
      next()
    }, 4500)
  }

  function restartAutoplayIfAllowed() {
    if (!autoplayPaused) startAutoplay()
  }

  function syncPauseUi() {
    pauseBtn.setAttribute('aria-pressed', String(autoplayPaused))
    pauseBtn.textContent = autoplayPaused ? 'Play slideshow' : 'Pause slideshow'
  }

  pauseBtn.addEventListener('click', () => {
    autoplayPaused = !autoplayPaused
    syncPauseUi()
    if (autoplayPaused) stopAutoplay()
    else startAutoplay()
  })

  if (prefersReducedMotion) {
    autoplayPaused = true
    syncPauseUi()
  }

  track.addEventListener('transitionend', (e) => {
    if (e.target !== track || e.propertyName !== 'transform') return
    normalizePosition()
  })

  const unlock = () => {
    if (!isAnimating) return
    normalizePosition()
  }

  prevBtn.disabled = false
  nextBtn.disabled = false
  prevBtn.addEventListener('click', () => {
    prev()
    restartAutoplayIfAllowed()
    window.setTimeout(unlock, 850)
  })
  nextBtn.addEventListener('click', () => {
    next()
    restartAutoplayIfAllowed()
    window.setTimeout(unlock, 850)
  })

  viewport.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight') {
      e.preventDefault()
      next()
      restartAutoplayIfAllowed()
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault()
      prev()
      restartAutoplayIfAllowed()
    } else if (e.key === 'Home') {
      e.preventDefault()
      goTo(cloneCount)
      restartAutoplayIfAllowed()
    } else if (e.key === 'End') {
      e.preventDefault()
      goTo(cloneCount + total - 1)
      restartAutoplayIfAllowed()
    }
  })

  viewport.addEventListener('touchstart', (e) => {
    touchStartX = e.touches[0].clientX
    touchDeltaX = 0
    stopAutoplay()
  }, { passive: true })

  viewport.addEventListener('touchmove', (e) => {
    touchDeltaX = e.touches[0].clientX - touchStartX
  }, { passive: true })

  viewport.addEventListener('touchend', () => {
    if (Math.abs(touchDeltaX) > 45) {
      if (touchDeltaX < 0) next()
      else prev()
    }
    restartAutoplayIfAllowed()
    touchDeltaX = 0
  })

  root.addEventListener('mouseenter', stopAutoplay)
  root.addEventListener('mouseleave', () => restartAutoplayIfAllowed())
  root.addEventListener('focusin', stopAutoplay)
  root.addEventListener('focusout', (e) => {
    if (!root.contains(e.relatedTarget)) restartAutoplayIfAllowed()
  })

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stopAutoplay()
    else restartAutoplayIfAllowed()
  })

  let resizeTimer = null
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer)
    resizeTimer = setTimeout(() => {
      applyTransform(false)
      syncActive()
    }, 120)
  })

  rebuildDots()
  applyTransform(false)
  syncActive()
  syncPauseUi()
  startAutoplay()
}

const resourcesSection = document.querySelector('.section-resources')
if (resourcesSection) {
  const carousel = resourcesSection.querySelector('[data-resources-carousel]')
  if (carousel) initResourcesCarousel(carousel)

  if (prefersReducedMotion || !('IntersectionObserver' in window)) {
    resourcesSection.classList.add('is-inview')
  } else {
    const resourcesObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return
          resourcesSection.classList.add('is-inview')
          resourcesObserver.unobserve(resourcesSection)
        })
      },
      { threshold: 0.18 }
    )
    resourcesObserver.observe(resourcesSection)
  }
}
}) // end scheduleIdle

// Contact FAQ accordion (exclusive open + deep-link support)
const faqAccordion = document.querySelector('[data-faq-accordion]')
if (faqAccordion) {
  const faqItems = [...faqAccordion.querySelectorAll('details.faq-item')]

  function openFaqById(id) {
    if (!id) return false
    const target = faqItems.find((item) => item.id === id)
    if (!target) return false
    faqItems.forEach((item) => {
      item.open = item === target
    })
    return true
  }

  faqItems.forEach((item) => {
    item.addEventListener('toggle', () => {
      if (!item.open) return
      faqItems.forEach((other) => {
        if (other !== item) other.open = false
      })
    })
  })

  const hashId = location.hash ? decodeURIComponent(location.hash.slice(1)) : ''
  if (hashId === 'faq' || hashId.startsWith('faq-')) {
    openFaqById(hashId === 'faq' ? faqItems[0]?.id : hashId)
  }

  window.addEventListener('hashchange', () => {
    const id = location.hash ? decodeURIComponent(location.hash.slice(1)) : ''
    if (id === 'faq') {
      openFaqById(faqItems[0]?.id)
      return
    }
    if (id.startsWith('faq-')) openFaqById(id)
  })
}
