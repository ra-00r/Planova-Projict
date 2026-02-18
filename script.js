'use strict';

document.addEventListener('DOMContentLoaded', () => {
  // Animate progress bars
  const bars = document.querySelectorAll('.progress__bar');
  bars.forEach((bar) => {
    const w = bar.dataset.width || '0%';
    bar.style.width = '0%';
    requestAnimationFrame(() => {
      setTimeout(() => (bar.style.width = w), 250);
    });
  });

  // Sidebar active state
  const navItems = document.querySelectorAll('.nav__item');
  navItems.forEach((item) => {
    item.addEventListener('click', (e) => {
      // لو الرابط #... نخليه يسوي سكرول لطيف
      const href = item.getAttribute('href');
      if (href && href.startsWith('#')) {
        e.preventDefault();
        const target = document.querySelector(href);
        if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }

      navItems.forEach((n) => n.classList.remove('active'));
      item.classList.add('active');
    });
  });

  // Buttons demo
  const newTask = document.querySelector('.new-task');
  if (newTask) {
    newTask.addEventListener('click', () => {
      alert('Add New Task (Demo)');
    });
  }
});