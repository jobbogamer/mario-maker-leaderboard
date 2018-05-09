import 'babel-polyfill';

import fs from 'fs';
import path from 'path';

import axios from 'axios';
import cheerio from 'cheerio';
import parseArgs from 'minimist';
import columnify from 'columnify';

const LEADERBOARD_URL =
  'https://supermariomakerbookmark.nintendo.net/creators?type=mario_100_super_expert';

const DATA_DIR = path.join('.', 'data');
const DATA_FILE = path.join(DATA_DIR, 'leaderboard.json');

const red = s => `\x1b[31m${s}\x1b[0m`;
const green = s => `\x1b[32m${s}\x1b[0m`;
const blue = s => `\x1b[34m${s}\x1b[0m`;

const loadHTML = async url => {
  try {
    const response = await axios.get(url);
    const body = await response.data;
    return body;
  } catch (err) {
    console.log('Failed to load HTML:', err);
  }
};

const loadFile = filename => {
  try {
    const text = fs.readFileSync(filename);
    return JSON.parse(text);
  } catch (err) {
    console.log('Failed to open file:', err);
    console.log('Attempting to create new file...');
    fs.mkdirSync(DATA_DIR);
    const text = JSON.stringify([], null, 2);
    fs.writeFileSync(filename, text);
    console.log('Created!');
  }
};

const saveFile = (filename, data) => {
  const text = JSON.stringify(data, null, 2);
  fs.writeFileSync(filename, text);
};

const getArgs = () => {
  const opts = {
    boolean: true,
    alias: {
      username: ['u'],
      noSave: ['nosave']
    }
  };
  return parseArgs(process.argv.slice(2), opts);
};

const parseEntry = ($, index, entry, previousEntries) => {
  const name = $(entry)
    .find('.creator-info')
    .find('.name')
    .text();

  const winText = $(entry)
    .find('.mario100-point')
    .find('.typography')
    .map((index, element) => {
      const digit = $(element).attr('class');
      return digit.charAt(digit.indexOf('-') + 1);
    });

  const wins = parseInt(winText.get().join(''));

  const previous = previousEntries.filter(
    previousEntry => previousEntry.name === name
  );

  return {
    position: index + 1,
    oldPosition: previous.length > 0 ? previous[0].position : -1,
    name,
    wins,
    oldWins: previous.length > 0 ? previous[0].wins : null
  };
};

const getPositionChange = (newPosition, oldPosition) => {
  if (!oldPosition) {
    return '';
  }

  if (oldPosition === -1) {
    return `${green('+')}`;
  }

  if (newPosition > oldPosition) {
    // return `${red('↓')} ${oldPosition}`;
    return `${red('↓')}`;
  }

  if (newPosition < oldPosition) {
    // return `${green('↑')} ${oldPosition}`;
    return `${green('↑')}`;
  }

  return '';
};

const getWinsChange = (newWins, oldWins) => {
  if (!oldWins) {
    return '';
  }

  if (newWins > oldWins) {
    return `${newWins - oldWins}`;
  }

  return '';
};

const getEntryAtPosition = (entries, position) => {
  return entries.filter(entry => entry.position === position)[0];
};

const hasChanged = (newEntries, oldEntries) => {
  const changed = newEntries.filter(entry => {
    const previousEntry = getEntryAtPosition(oldEntries, entry.position);
    return (
      entry.name !== previousEntry.name || entry.wins !== previousEntry.wins
    );
  });
  return changed.length > 0;
};

const parseLeaderboard = (html, previousEntries = {}) => {
  const $ = cheerio.load(html);
  return $('.creator-ranking')
    .find('.creator-card')
    .map((index, entry) => parseEntry($, index, entry, previousEntries))
    .get();
};

const printLeaderboard = (entries, highlightUsername, count = 10) => {
  const rows = entries.slice(0, count).map(entry => {
    const highlighted = s =>
      !!highlightUsername &&
      highlightUsername.toLowerCase() === entry.name.toLowerCase()
        ? blue(s)
        : s;

    return {
      position: highlighted(entry.position),
      positionChange: getPositionChange(entry.position, entry.oldPosition),
      name: highlighted(entry.name),
      wins: highlighted(entry.wins),
      winsChange: highlighted(getWinsChange(entry.wins, entry.oldWins))
    };
  });

  const options = {
    config: {
      position: {
        headingTransform: () => 'POS',
        align: 'right'
      },
      positionChange: { showHeaders: false },
      wins: { align: 'right' },
      winsChange: { headingTransform: () => '+', align: 'right' }
    }
  };

  return columnify(rows, options);
};

loadHTML(LEADERBOARD_URL).then(html => {
  const { n: count = 10, username, noSave } = getArgs();

  const previousEntries = loadFile(DATA_FILE);
  const entries = parseLeaderboard(html, previousEntries);

  if (!noSave && hasChanged(entries, previousEntries)) {
    saveFile(DATA_FILE, entries);
  }

  const output = printLeaderboard(entries, username, count);
  console.log('');
  console.log(output);
  console.log('');
});
