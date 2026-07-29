import './style.css'

// Mobile navigation toggle
const navToggle = document.querySelector('.nav-toggle')
const navMenu = document.querySelector('.nav-menu')

if (navToggle && navMenu) {
  navToggle.addEventListener('click', () => {
    navToggle.classList.toggle('active')
    navMenu.classList.toggle('active')
    const isExpanded = navToggle.classList.contains('active')
    navToggle.setAttribute('aria-expanded', isExpanded)
  })

  // Close mobile menu when clicking a link
  navMenu.querySelectorAll('a').forEach(link => {
    link.addEventListener('click', () => {
      navToggle.classList.remove('active')
      navMenu.classList.remove('active')
      navToggle.setAttribute('aria-expanded', 'false')
    })
  })
}

// Smooth scroll for anchor links
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
  anchor.addEventListener('click', function (e) {
    const targetId = this.getAttribute('href')
    if (targetId === '#') return
    const target = document.querySelector(targetId)
    if (target) {
      e.preventDefault()
      target.scrollIntoView({ behavior: 'smooth' })
    }
  })
})

// Contact form handling
const contactForm = document.querySelector('.contact-form')

if (contactForm) {
  contactForm.addEventListener('submit', async function (e) {
    e.preventDefault()

    const statusEl = document.querySelector('.form-status')
    const submitBtn = contactForm.querySelector('button[type="submit"]')
    const originalText = submitBtn.textContent

    // Basic validation
    const requiredFields = contactForm.querySelectorAll('[required]')
    let isValid = true

    requiredFields.forEach(field => {
      if (!field.value.trim()) {
        isValid = false
        field.classList.add('error')
      } else {
        field.classList.remove('error')
      }
    })

    if (!isValid) {
      showStatus(statusEl, 'Please fill in all required fields.', 'error')
      return
    }

    // Email validation
    const emailField = contactForm.querySelector('#email')
    if (emailField && !isValidEmail(emailField.value)) {
      showStatus(statusEl, 'Please enter a valid email address.', 'error')
      return
    }

    // Simulate form submission
    submitBtn.disabled = true
    submitBtn.textContent = 'Sending...'

    try {
      // Placeholder: Replace with actual form endpoint (Netlify Forms, Formspree, etc.)
      await simulateFormSubmission(new FormData(contactForm))

      showStatus(statusEl, 'Thank you. Your message has been received and we will respond within one business day.', 'success')
      contactForm.reset()
    } catch (error) {
      showStatus(statusEl, 'Something went wrong. Please call us directly or try again later.', 'error')
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

  // Scroll status into view
  element.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
}

function simulateFormSubmission(formData) {
  return new Promise((resolve) => {
    // Simulate network delay
    setTimeout(() => {
      // eslint-disable-next-line no-console
      console.log('Form data (replace with real submission):', Object.fromEntries(formData))
      resolve()
    }, 1200)
  })
}

// Add simple scroll reveal for sections
const revealElements = document.querySelectorAll('.service-card, .testimonial-card, .resource-card, .stat-card')

if ('IntersectionObserver' in window) {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.style.opacity = '1'
        entry.target.style.transform = 'translateY(0)'
        observer.unobserve(entry.target)
      }
    })
  }, { threshold: 0.1 })

  revealElements.forEach(el => {
    el.style.opacity = '0'
    el.style.transform = 'translateY(20px)'
    el.style.transition = 'opacity 0.6s ease, transform 0.6s ease'
    observer.observe(el)
  })
}
