const {
    build
} = require('./src/command');

try {
    build();
} catch (e) {
    console.error(e);
}