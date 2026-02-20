const toggle = document.querySelector('.menu-toggle');
const nav = document.querySelector('.site-nav');
const siteHeader = document.querySelector('.site-header');
const revealNodes = document.querySelectorAll('.reveal');
const year = document.querySelector('#year');
const eventsList = document.querySelector('#events-list');
const nextEventHighlight = document.querySelector('#next-event-highlight');
const logoLink = document.querySelector('.logo-centered');
const logoImage = logoLink ? logoLink.querySelector('.logo-image') : null;
const constructionNotice = document.querySelector('#construction-notice');
const constructionClose = document.querySelector('#construction-close');

if (year) {
  year.textContent = new Date().getFullYear();
}

if (constructionNotice && constructionClose) {
  initializeConstructionNotice(constructionNotice, constructionClose);
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

markActiveNavigation();
setHeaderAccent();
enableRevealAnimations(revealNodes);

if (eventsList) {
  loadEvents(eventsList);
}

if (nextEventHighlight) {
  loadNextEvent(nextEventHighlight);
}

if (logoLink && logoImage) {
  enableOpaquePixelLogoClick(logoLink, logoImage);
}

function initializeConstructionNotice(noticeNode, closeButtonNode) {
  document.body.classList.add('notice-open');

  const closeNotice = () => {
    if (noticeNode.classList.contains('is-hidden')) {
      return;
    }

    noticeNode.classList.add('is-hidden');
    document.body.classList.remove('notice-open');
  };

  closeButtonNode.addEventListener('click', closeNotice);

  noticeNode.addEventListener('click', (event) => {
    if (event.target === noticeNode) {
      closeNotice();
    }
  });

  window.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      closeNotice();
    }
  });
}

function markActiveNavigation() {
  const currentFile = getCurrentFileName();

  document.querySelectorAll('.site-nav a[href]').forEach((linkNode) => {
    const hrefValue = linkNode.getAttribute('href');
    if (!hrefValue || hrefValue.startsWith('#') || hrefValue.startsWith('http')) {
      return;
    }

    const targetFile = getHrefFileName(hrefValue);
    if (targetFile === currentFile) {
      linkNode.classList.add('active');
    }
  });
}

function setHeaderAccent() {
  if (!siteHeader) {
    return;
  }

  const bodyPage = document.body.dataset.page;
  if (bodyPage) {
    siteHeader.dataset.section = bodyPage;
    return;
  }

  const firstSection = document.querySelector('main section[id]');
  siteHeader.dataset.section = firstSection ? firstSection.id : 'accueil';
}

function getCurrentFileName() {
  const normalizedPath = window.location.pathname.replace(/\\/g, '/');
  const lastSegment = normalizedPath.split('/').pop();

  if (!lastSegment) {
    return 'index.html';
  }

  return lastSegment.toLowerCase();
}

function getHrefFileName(hrefValue) {
  const strippedHref = hrefValue.split('#')[0].split('?')[0].replace(/\\/g, '/');

  if (!strippedHref || strippedHref === '/') {
    return 'index.html';
  }

  const lastSegment = strippedHref.split('/').pop();
  return (lastSegment || 'index.html').toLowerCase();
}

function enableRevealAnimations(nodes) {
  if (!nodes.length) {
    return;
  }

  if (!('IntersectionObserver' in window)) {
    nodes.forEach((node) => node.classList.add('is-visible'));
    return;
  }

  const observer = new IntersectionObserver(
    (entries, obs) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) {
          return;
        }

        requestAnimationFrame(() => {
          entry.target.classList.add('is-visible');
        });
        obs.unobserve(entry.target);
      });
    },
    {
      threshold: 0.1,
      rootMargin: '0px 0px -8% 0px',
    }
  );

  nodes.forEach((node, index) => {
    const revealDelay = Math.min(index * 65, 320);
    node.style.setProperty('--reveal-delay', `${revealDelay}ms`);
    observer.observe(node);
  });
}

async function loadEvents(container) {
  const source = container.dataset.source || 'data/events.json';

  try {
    const normalizedEvents = await fetchNormalizedEvents(source);
    const { upcoming, past } = splitEventsByDate(normalizedEvents);

    container.replaceChildren();

    const upcomingSection = buildEventsCategory(
      'Evenements a venir',
      upcoming,
      'Aucun evenement prevu pour le moment. Notre programmation est en preparation.'
    );

    const pastSection = buildEventsCategory(
      'Evenements passes',
      past.slice().reverse(),
      'Aucun evenement passe pour le moment.'
    );

    container.append(upcomingSection, pastSection);
    enablePastEventsScroll(pastSection, 3);
  } catch (error) {
    console.error('Impossible de charger les evenements :', error);
    container.replaceChildren(
      buildMessageCard("Impossible de charger l'agenda. Verifie data/events.json.")
    );
  }
}

async function loadNextEvent(container) {
  const source = container.dataset.source || 'data/events.json';

  try {
    const normalizedEvents = await fetchNormalizedEvents(source);
    const nextEvent = findNextEvent(normalizedEvents);

    container.replaceChildren();

    if (!nextEvent) {
      container.appendChild(
        buildNextEventMessage(
          'Aucun evenement prevu pour le moment. Notre programmation est en preparation.'
        )
      );
      return;
    }

    container.appendChild(buildNextEventCard(nextEvent));
  } catch (error) {
    console.error('Impossible de charger le prochain evenement :', error);
    container.replaceChildren(buildNextEventMessage('Impossible de charger le prochain rendez-vous.'));
  }
}

async function fetchNormalizedEvents(source) {
  const response = await fetch(source, { cache: 'no-store' });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  const payload = await response.json();
  const events = Array.isArray(payload) ? payload : payload.events;

  if (!Array.isArray(events)) {
    throw new Error('Invalid events payload');
  }

  return events
    .map((eventItem) => normalizeEvent(eventItem))
    .filter(Boolean)
    .sort((a, b) => a.date - b.date);
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

function findNextEvent(events) {
  const today = getTodayStart();
  return events.find((eventItem) => eventItem.date >= today) || null;
}

function splitEventsByDate(events) {
  const today = getTodayStart();
  const upcoming = [];
  const past = [];

  events.forEach((eventItem) => {
    if (eventItem.date >= today) {
      upcoming.push(eventItem);
      return;
    }

    past.push(eventItem);
  });

  return { upcoming, past };
}

function getTodayStart() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
}

function formatEventDate(dateValue) {
  return new Intl.DateTimeFormat('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(dateValue);
}

function buildEventCard(eventItem) {
  const article = document.createElement('article');

  const dateNode = document.createElement('p');
  dateNode.className = 'date';
  dateNode.textContent = formatEventDate(eventItem.date);

  const titleNode = document.createElement('h3');
  titleNode.textContent = eventItem.title;

  const descriptionNode = document.createElement('p');
  descriptionNode.textContent = eventItem.description;

  article.append(dateNode, titleNode, descriptionNode);
  return article;
}

function buildEventsCategory(title, events, emptyMessage) {
  const section = document.createElement('section');
  section.className = 'events-category';

  const titleNode = document.createElement('h3');
  titleNode.className = 'events-category-title';
  titleNode.textContent = title;

  const list = document.createElement('div');
  list.className = 'events-category-list';

  if (!events.length) {
    list.appendChild(buildMessageCard(emptyMessage));
  } else {
    events.forEach((eventItem) => {
      list.appendChild(buildEventCard(eventItem));
    });
  }

  section.append(titleNode, list);
  return section;
}

function enablePastEventsScroll(categoryNode, visibleCardsCount) {
  if (!categoryNode || visibleCardsCount <= 0) {
    return;
  }

  const listNode = categoryNode.querySelector('.events-category-list');
  if (!listNode) {
    return;
  }

  const cardNodes = Array.from(listNode.children).filter((node) => node.matches('article'));
  if (cardNodes.length <= visibleCardsCount) {
    listNode.classList.remove('events-category-list-scroll');
    listNode.style.removeProperty('max-height');
    return;
  }

  const updateMaxHeight = () => {
    const computedStyle = window.getComputedStyle(listNode);
    const rowGap = parseFloat(computedStyle.rowGap || computedStyle.gap || '0') || 0;
    let maxHeight = 0;

    for (let index = 0; index < visibleCardsCount; index += 1) {
      const cardNode = cardNodes[index];
      if (!cardNode) {
        break;
      }

      maxHeight += cardNode.getBoundingClientRect().height;
      if (index < visibleCardsCount - 1) {
        maxHeight += rowGap;
      }
    }

    if (maxHeight > 0) {
      listNode.style.maxHeight = `${Math.ceil(maxHeight)}px`;
    }
  };

  listNode.classList.add('events-category-list-scroll');
  updateMaxHeight();
  requestAnimationFrame(updateMaxHeight);
  window.addEventListener('resize', updateMaxHeight, { passive: true });
}

function buildNextEventCard(eventItem) {
  const article = document.createElement('article');
  article.className = 'next-event-card';

  const eyebrowNode = document.createElement('p');
  eyebrowNode.className = 'eyebrow';
  eyebrowNode.textContent = 'Prochain evenement';

  const dateNode = document.createElement('p');
  dateNode.className = 'date';
  dateNode.textContent = formatEventDate(eventItem.date);

  const titleNode = document.createElement('h3');
  titleNode.textContent = eventItem.title;

  const descriptionNode = document.createElement('p');
  descriptionNode.textContent = eventItem.description;

  const actionLink = document.createElement('a');
  actionLink.className = 'btn btn-sm';
  actionLink.href = 'evenements.html';
  actionLink.textContent = "Voir l'agenda complet";

  article.append(eyebrowNode, dateNode, titleNode, descriptionNode, actionLink);
  return article;
}

function buildNextEventMessage(message) {
  const article = document.createElement('article');
  article.className = 'next-event-card';

  const eyebrowNode = document.createElement('p');
  eyebrowNode.className = 'eyebrow';
  eyebrowNode.textContent = 'Prochain evenement';

  const textNode = document.createElement('p');
  textNode.textContent = message;

  article.append(eyebrowNode, textNode);
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

function enableOpaquePixelLogoClick(linkNode, imageNode) {
  const alphaThreshold = 10;
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d', { willReadFrequently: true });
  let alphaMap = null;
  let mapWidth = 0;
  let mapHeight = 0;

  const prepareAlphaMap = () => {
    if (!context || !imageNode.naturalWidth || !imageNode.naturalHeight) {
      return;
    }

    mapWidth = imageNode.naturalWidth;
    mapHeight = imageNode.naturalHeight;
    canvas.width = mapWidth;
    canvas.height = mapHeight;
    context.clearRect(0, 0, mapWidth, mapHeight);
    context.drawImage(imageNode, 0, 0, mapWidth, mapHeight);
    alphaMap = context.getImageData(0, 0, mapWidth, mapHeight).data;
  };

  const getAlphaAtPointer = (clientX, clientY) => {
    if (!alphaMap || !mapWidth || !mapHeight) {
      return 255;
    }

    const rect = imageNode.getBoundingClientRect();
    if (!rect.width || !rect.height) {
      return 255;
    }

    const x = Math.floor((clientX - rect.left) * (mapWidth / rect.width));
    const y = Math.floor((clientY - rect.top) * (mapHeight / rect.height));

    if (x < 0 || y < 0 || x >= mapWidth || y >= mapHeight) {
      return 0;
    }

    return alphaMap[(y * mapWidth + x) * 4 + 3];
  };

  if (imageNode.complete) {
    prepareAlphaMap();
  } else {
    imageNode.addEventListener('load', prepareAlphaMap, { once: true });
  }

  linkNode.addEventListener('mousemove', (event) => {
    const alpha = getAlphaAtPointer(event.clientX, event.clientY);
    linkNode.style.cursor = alpha >= alphaThreshold ? 'pointer' : 'default';
  });

  linkNode.addEventListener('mouseleave', () => {
    linkNode.style.cursor = 'default';
  });

  linkNode.addEventListener('click', (event) => {
    // Preserve keyboard accessibility (Enter/Space) and only filter pointer clicks.
    if (!(event instanceof MouseEvent) || event.detail === 0) {
      return;
    }

    const alpha = getAlphaAtPointer(event.clientX, event.clientY);
    if (alpha >= alphaThreshold) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
  });
}
