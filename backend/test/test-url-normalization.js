const { normalizeUrl } = require('../services/storyDeduplication');

// Test URL normalization
console.log('Testing URL normalization...\n');

const testCases = [
    ['https://techcrunch.com/2025/12/01/at-least-36-new-tech-unicorns-were-minted-in-2025-so-far/',
        'https://techcrunch.com/2025/12/01/at-least-36-new-tech-unicorns-were-minted-in-2025-so-far'],
    ['https://www.techcrunch.com/2025/12/01/story/',
        'https://techcrunch.com/2025/12/01/story/'],
    ['https://example.com/path/?utm_source=test&foo=bar',
        'https://example.com/path/'],
    ['https://example.com/path#section',
        'https://example.com/path/']
];

testCases.forEach(([url1, url2], i) => {
    const normalized1 = normalizeUrl(url1);
    const normalized2 = normalizeUrl(url2);
    const match = normalized1 === normalized2;

    console.log(`Test ${i + 1}: ${match ? '✓ PASS' : '✗ FAIL'}`);
    console.log(`  URL 1: ${url1}`);
    console.log(`  Normalized: ${normalized1}`);
    console.log(`  URL 2: ${url2}`);
    console.log(`  Normalized: ${normalized2}`);
    console.log(`  Match: ${match}\n`);
});

console.log('\nTest specific duplicate:');
const duplicateUrl = 'https://techcrunch.com/2025/12/01/at-least-36-new-tech-unicorns-were-minted-in-2025-so-far/';
console.log(`Original: ${duplicateUrl}`);
console.log(`Normalized: ${normalizeUrl(duplicateUrl)}`);
