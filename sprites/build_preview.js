const { optimize } = require('svgo');
const fs = require('fs');

const out = {};

fs.readdirSync(__dirname + '/svg').forEach((file) => {
  const fpath = __dirname + '/svg/' + file;
  const svg = fs.readFileSync(fpath, 'utf8');
  const name = fpath.split('/').pop().split('.')[0];

  const optimized = optimize(svg, {
    path: fpath,
    multipass: true,
  });

  out['feature:' + name] = optimized.data;
});


fs.writeFileSync(__dirname + '/preview.json', JSON.stringify(out, null, 2));
