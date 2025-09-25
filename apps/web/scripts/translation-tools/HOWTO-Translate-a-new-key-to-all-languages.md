# How to Translate a New Key to All Languages

This guide explains how to add translations for a new English key across all supported languages in Hylo.

## 📋 Quick Reference

1. Add the new key to `public/locales/en.json`
2. Run `node scripts/translation-tools/findMissingTranslations.js` to identify missing translations
3. Use `scripts/translation-tools/processMissingKeys.js` to generate translation templates
4. Translate the templates
5. Apply translations using `scripts/translation-tools/applyMissingTranslations.js`

## 🔄 Detailed Workflow

### Step 1: Add New English Key

1. Open `public/locales/en.json`
2. Add your new key and English text
3. Keep keys in alphabetical order
4. Save the file

Example:
```json
{
  // ... existing keys ...
  "my.new.feature": "My new feature description",
  // ... existing keys ...
}
```

### Step 2: Find Missing Translations

Run:
```bash
node scripts/translation-tools/findMissingTranslations.js
```

This will:
- Compare all language files against English
- Generate reports of missing keys for each language
- Create files like `missing-es-keys.json`, `missing-fr-keys.json`, etc.

### Step 3: Generate Translation Templates

Run:
```bash
node scripts/translation-tools/processMissingKeys.js es  # For Spanish
node scripts/translation-tools/processMissingKeys.js fr  # For French
# etc. for each language
```

This creates template files with:
- Original English text
- Placeholders for translations
- Preserved variables and formatting

### Step 4: Translate Templates

For each language:
1. Open the generated template (e.g., `es-template.json`)
2. Replace `[TRANSLATE: ...]` placeholders with appropriate translations
3. Save the file

Remember:
- Preserve all variables (e.g., `{{userName}}`)
- Maintain HTML tags
- Keep technical terms as needed
- Follow language-specific guidelines

### Step 5: Apply Translations

Run:
```bash
node scripts/translation-tools/applyMissingTranslations.js es  # For Spanish
node scripts/translation-tools/applyMissingTranslations.js fr  # For French
# etc. for each language
```

This will:
- Validate translations
- Add new translations to language files
- Maintain file formatting

## ✅ Verification

After applying translations:

1. Check each language file
2. Verify the new key exists
3. Test in the application
4. Check for formatting issues

## 🚫 Common Mistakes to Avoid

1. **Don't** manually edit language files directly
2. **Don't** forget to preserve variables
3. **Don't** translate technical terms unnecessarily
4. **Don't** skip the validation step

## 🔍 Special Cases

### HTML Content
```json
"key.with.html": "Click <strong>here</strong> to continue"
// Preserve HTML tags in translations
```

### Variables
```json
"welcome.message": "Welcome, {{userName}}!"
// Keep variables exactly as they appear
```

### Technical Terms
```json
"export.csv": "Export to CSV"
// Usually keep technical terms in English
```

## 🌍 Language-Specific Guidelines

### Spanish (es)
- Use formal "usted" form
- Maintain gender-neutral language where possible
- Keep technical terms in English

### French (fr)
- Use formal "vous" form
- Include proper accents and punctuation
- Adapt technical terms when French equivalents exist

### Hindi (hi)
- Use Devanagari script
- Use formal "आप" form
- Keep technical terms in English
- Right-to-left text support where needed

## 🛠 Troubleshooting

### Missing Templates
```bash
# Regenerate templates
node scripts/translation-tools/processMissingKeys.js [lang]
```

### Invalid JSON
```bash
# Validate JSON format
node scripts/translation-tools/validateLocales.js
```

### Duplicate Keys
```bash
# Find and fix duplicates
node scripts/translation-tools/findDuplicates.js
```

## 📚 Additional Resources

- See `TRANSLATION_WORKFLOW.md` for full translation process
- Check language-specific style guides in `/docs`
- Review existing translations for consistency

Remember: Quality translations maintain consistency across the platform and enhance user experience for all language communities. 