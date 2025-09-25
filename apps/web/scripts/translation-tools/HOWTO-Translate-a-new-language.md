# Translation Workflow for Hylo Platform

This document outlines the systematic, chunked approach to translating localization files for the Hylo platform. The workflow is designed to be **slow, smooth, and fast** - breaking down large translation tasks into manageable chunks.

## 🎯 Philosophy: "Slow is Smooth, Smooth is Fast"

Rather than attempting to translate 1,400+ keys at once, this workflow:
- **Chunks work** into 100-key batches for manageable progress
- **Tracks progress** with resumable states
- **Validates quality** at each step
- **Prevents errors** through incremental validation
- **Enables collaboration** with clear handoff points

## 📁 Available Scripts

| Script | Purpose | Usage |
|--------|---------|-------|
| `translateToLanguage.js` | Create translation plan | `node scripts/translation-tools/translateToLanguage.js hi` |
| `processChunk.js` | Generate translation template | `node scripts/translation-tools/processChunk.js hi 1` |
| `applyChunk.js` | Apply completed translations | `node scripts/translation-tools/applyChunk.js hi 1` |
| `finalizeTranslation.js` | Sort and validate final file | `node scripts/translation-tools/finalizeTranslation.js hi` |
| `checkProgress.js` | Check translation progress | `node scripts/translation-tools/checkProgress.js hi` |
| `sortLocales.js` | Sort locale files alphabetically | `node scripts/translation-tools/sortLocales.js` |
| `findDuplicates.js` | Find/remove duplicate keys | `node scripts/translation-tools/findDuplicates.js` |
| `findExtraKeys.js` | Find/remove extra keys | `node scripts/translation-tools/findExtraKeys.js` |

## 🔄 Complete Workflow

### Phase 1: Planning
```bash
# Create translation plan for Hindi
node scripts/translation-tools/translateToLanguage.js hi

# Check what needs to be done
node scripts/translation-tools/checkProgress.js hi
```

**Output**: Creates `translation-plan-hi.json` with work breakdown

### Phase 2: Chunked Translation
```bash
# Process chunk 1 (creates template)
node scripts/translation-tools/processChunk.js hi 1

# Manually translate in: chunk-1-hi-template.json
# Replace [TRANSLATE: ...] with actual Hindi translations

# Apply completed chunk 1
node scripts/translation-tools/applyChunk.js hi 1

# Repeat for chunks 2, 3, etc.
node scripts/translation-tools/processChunk.js hi 2
# ... translate ...
node scripts/translation-tools/applyChunk.js hi 2
```

### Phase 3: Finalization
```bash
# When all chunks complete
node scripts/translation-tools/finalizeTranslation.js hi

# Final cleanup (if needed)
node scripts/translation-tools/sortLocales.js
```

## 🌍 Supported Languages

| Code | Language | Status |
|------|----------|--------|
| `en` | English | ✅ Source |
| `fr` | French | ✅ Complete |
| `es` | Spanish | ✅ Complete |
| `hi` | Hindi | 🟡 Ready to start |

## 📋 Translation Guidelines

### 🔤 Text Guidelines
- **Preserve variables**: Keep `{{name}}`, `{{count}}`, `{{groupName}}` exactly as-is
- **Maintain HTML**: Keep tags like `<strong>`, `<em>`, `<a href="">` intact
- **Technical terms**: URLs, "Stripe", "CSV" can remain in English
- **Professional tone**: Use formal, platform-appropriate language

### 🇮🇳 Hindi-Specific Guidelines
- **Script**: Use Devanagari script (हिंदी)
- **Formality**: Use आप (formal "you") instead of तुम/तू
- **Technical terms**: Adapt when Hindi equivalent exists, otherwise keep English
- **Cultural adaptation**: Consider Indian context for examples and references

### ✅ Quality Checklist
- [ ] All `[TRANSLATE: ...]` placeholders replaced
- [ ] Variable count matches original ({{variable}})
- [ ] HTML tags preserved and properly closed
- [ ] No untranslated English fragments
- [ ] Cultural appropriateness checked
- [ ] Technical terms handled consistently

## 📊 Progress Tracking

### Check Overall Progress
```bash
# See all translation projects
node scripts/translation-tools/checkProgress.js

# Check specific language
node scripts/translation-tools/checkProgress.js hi
```

### Resume Work
The workflow is fully resumable. If interrupted:
1. Run `node scripts/translation-tools/checkProgress.js hi` to see current state
2. Continue with the next pending chunk
3. All completed work is preserved

## 🛠 Troubleshooting

### Common Issues

**Problem**: "Translation plan not found"
```bash
# Solution: Create the plan first
node scripts/translation-tools/translateToLanguage.js hi
```

**Problem**: "Template file not found"
```bash
# Solution: Generate the template
node scripts/translation-tools/processChunk.js hi 1
```

**Problem**: "Keys still need translation"
```bash
# Solution: Complete all translations in template file
# Make sure no [TRANSLATE: ...] placeholders remain
```

### File Cleanup
```bash
# Remove extra keys (if any)
node scripts/translation-tools/findExtraKeys.js

# Remove duplicates (if any)  
node scripts/translation-tools/findDuplicates.js

# Sort all locale files
node scripts/translation-tools/sortLocales.js
```

## 📈 Workflow Benefits

### ✅ Advantages
- **Manageable chunks**: 100 keys at a time vs 1,400+ at once
- **Progress tracking**: Always know where you are
- **Quality gates**: Validation at each step
- **Resumable**: Can pause and continue anytime
- **Collaborative**: Multiple people can work on different chunks
- **Error prevention**: Issues caught early in small batches

### 🎯 Best Practices
1. **Complete one chunk fully** before starting the next
2. **Review translations** for consistency within each chunk
3. **Test key examples** in the application if possible
4. **Keep translation notes** for complex terms or decisions
5. **Regular progress checks** to stay on track

## 🚀 Getting Started with Hindi

Ready to start Hindi translation? Follow these steps:

```bash
# 1. Create the translation plan
node scripts/translation-tools/translateToLanguage.js hi

# 2. Start with chunk 1
node scripts/translation-tools/processChunk.js hi 1

# 3. Open chunk-1-hi-template.json and translate
# 4. Apply when complete
node scripts/translation-tools/applyChunk.js hi 1

# 5. Check progress and continue
node scripts/translation-tools/checkProgress.js hi
```

The systematic approach ensures high-quality translations while maintaining momentum through manageable progress increments. 