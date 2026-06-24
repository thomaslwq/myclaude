import { unlinkSync } from 'fs';
unlinkSync('_del_temp.mjs');
console.log('Cleaned up');
