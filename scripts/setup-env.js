// Crea src/environments/environment*.ts a partir de las plantillas *.example.ts
// si todavía no existen. Nunca sobrescribe un archivo existente.
const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, '..', 'src', 'environments');
const pairs = [
  ['environment.example.ts', 'environment.ts'],
  ['environment.prod.example.ts', 'environment.prod.ts'],
];

for (const [example, target] of pairs) {
  const targetPath = path.join(dir, target);
  if (!fs.existsSync(targetPath)) {
    fs.copyFileSync(path.join(dir, example), targetPath);
    console.log(`[setup-env] Creado ${target} desde ${example}. Rellena tus valores de Firebase.`);
  }
}
