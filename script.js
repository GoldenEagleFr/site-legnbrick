const toggle = document.querySelector('.menu-toggle');
const nav = document.querySelector('.site-nav');
const revealNodes = document.querySelectorAll('.reveal');
const year = document.querySelector('#year');
const eventsList = document.querySelector('#events-list');

if (year) {
  year.textContent = new Date().getFullYear();
}

if (toggle && nav) {
  toggle.addEventListener('click', () => {
    const opened = nav.classList.toggle('open');
    toggle.setAttribute('aria-expanded', String(opened));
  });

  nav.querySelectorAll('a').forEach((link) => {
    link.addEventListener('click', () => {
      nav.classList.remove('open');
      toggle.setAttribute('aria-expanded', 'false');
    });
  });
}

const observer = new IntersectionObserver(
  (entries, obs) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) {
        return;
      }

      entry.target.classList.add('is-visible');
      obs.unobserve(entry.target);
    });
  },
  { threshold: 0.15 }
);

revealNodes.forEach((node) => observer.observe(node));

if (eventsList) {
  loadEvents(eventsList);
}

async function loadEvents(container) {
  const source = container.dataset.source || 'data/events.json';

  try {
    const response = await fetch(source, { cache: 'no-store' });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const payload = await response.json();
    const events = Array.isArray(payload) ? payload : payload.events;

    if (!Array.isArray(events)) {
      throw new Error('Invalid events payload');
    }

    const normalizedEvents = events
      .map((eventItem) => normalizeEvent(eventItem))
      .filter(Boolean)
      .sort((a, b) => a.date - b.date);

    container.replaceChildren();

    if (!normalizedEvents.length) {
      container.appendChild(buildMessageCard('Aucun evenement prevu pour le moment.'));
      return;
    }

    normalizedEvents.forEach((eventItem) => {
      container.appendChild(buildEventCard(eventItem));
    });
  } catch (error) {
    console.error('Impossible de charger les evenements:', error);
    container.replaceChildren(
      buildMessageCard("Impossible de charger l'agenda. Verifie data/events.json.")
    );
  }
}

function normalizeEvent(eventItem) {
  if (!eventItem || typeof eventItem !== 'object') {
    return null;
  }

  const date = parseIsoDate(eventItem.date);
  const title = typeof eventItem.title === 'string' ? eventItem.title.trim() : '';
  const description =
    typeof eventItem.description === 'string' ? eventItem.description.trim() : '';

  if (!date || !title || !description) {
    return null;
  }

  return {
    date,
    title,
    description,
  };
}

function parseIsoDate(value) {
  if (typeof value !== 'string') {
    return null;
  }

  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) {
    return null;
  }

  const yearValue = Number(match[1]);
  const monthValue = Number(match[2]) - 1;
  const dayValue = Number(match[3]);

  const date = new Date(yearValue, monthValue, dayValue);
  if (
    date.getFullYear() !== yearValue ||
    date.getMonth() !== monthValue ||
    date.getDate() !== dayValue
  ) {
    return null;
  }

  return date;
}

function buildEventCard(eventItem) {
  const article = document.createElement('article');

  const dateNode = document.createElement('p');
  dateNode.className = 'date';
  dateNode.textContent = new Intl.DateTimeFormat('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(eventItem.date);

  const titleNode = document.createElement('h3');
  titleNode.textContent = eventItem.title;

  const descriptionNode = document.createElement('p');
  descriptionNode.textContent = eventItem.description;

  article.append(dateNode, titleNode, descriptionNode);
  return article;
}

function buildMessageCard(message) {
  const article = document.createElement('article');
  article.className = 'events-message';

  const textNode = document.createElement('p');
  textNode.textContent = message;

  article.appendChild(textNode);
  return article;
}