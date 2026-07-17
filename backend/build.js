const esbuild = require('esbuild');
const JavaScriptObfuscator = require('javascript-obfuscator');
const fs = require('fs-extra');
const path = require('path');

async function build() {
    console.log('1. Bundling backend with esbuild...');
    
    // Ensure build directory exists
    await fs.ensureDir('build');
    
    // Bundle everything starting from index.js
    // PENTING: Modul native (C++) HARUS di-external karena tidak bisa dibundel
    await esbuild.build({
        entryPoints: ['index.js'],
        bundle: true,
        platform: 'node',
        target: 'node18',
        outfile: 'build/bundle.js',
        external: [
            'sqlite3',           // Database SQLite (native C++)
            'node-machine-id',   // Pembaca ID Hardware (native C++)
            'bcryptjs',          // Enkripsi password
            'better-sqlite3',    // Alternatif SQLite
        ]
    });

    console.log('2. Obfuscating bundled code...');
    const code = await fs.readFile('build/bundle.js', 'utf8');
    
    const obfuscationResult = JavaScriptObfuscator.obfuscate(code, {
        compact: true,
        controlFlowFlattening: true,
        controlFlowFlatteningThreshold: 0.75,
        deadCodeInjection: true,
        deadCodeInjectionThreshold: 0.4,
        // PENTING: debugProtection & selfDefending dimatikan karena 
        // fitur ini dirancang untuk browser, bukan Node.js server.
        // Jika diaktifkan, server akan nge-hang/macet.
        debugProtection: false,
        debugProtectionInterval: 0,
        disableConsoleOutput: false,
        identifierNamesGenerator: 'hexadecimal',
        log: false,
        numbersToExpressions: true,
        renameGlobals: false,
        selfDefending: false,
        simplify: true,
        ignoreRequireImports: true,
        splitStrings: true,
        splitStringsChunkLength: 10,
        stringArray: true,
        stringArrayCallsTransform: true,
        stringArrayCallsTransformThreshold: 0.5,
        stringArrayEncoding: ['base64'],
        stringArrayIndexShift: true,
        stringArrayRotate: true,
        stringArrayShuffle: true,
        stringArrayWrappersCount: 1,
        stringArrayWrappersChainedCalls: true,
        stringArrayWrappersParametersMaxCount: 2,
        stringArrayWrappersType: 'variable',
        stringArrayThreshold: 0.75,
        target: 'node',
        unicodeEscapeSequence: false
    });

    await fs.writeFile('build/index.js', obfuscationResult.getObfuscatedCode());
    
    // Cleanup temporary bundle.js
    await fs.remove('build/bundle.js');
    
    console.log('3. Build and obfuscation complete! Ready for deployment.');
}

build().catch(err => {
    console.error('Build failed:', err);
    process.exit(1);
});
