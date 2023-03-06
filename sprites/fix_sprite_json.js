const fs = require('fs');

const json = JSON.parse(fs.readFileSync(__dirname + '/sprite/sprite.json', 'utf8'));

for (const k of Object.keys(json)) {
  json[k].sdf = true;
}

fs.writeFileSync(__dirname + '/sprite/sprite.json', JSON.stringify(json, null, 2));
