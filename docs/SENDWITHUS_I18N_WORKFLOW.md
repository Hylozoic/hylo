# SendWithUs i18n Workflow Guide

This guide documents the standard workflows for maintaining internationalized email templates in SendWithUs.

## Prerequisites

### Setting Up SendWithUs API Key

The SendWithUs API key is required for all operations. Set it up in one of the following ways:

1. **Environment Variable** (recommended for CI/CD):
   ```bash
   export SENDWITHUS_KEY=your_api_key_here
   ```

2. **Local .env File** (recommended for local development):
   Create a `.env` file in `scripts/i18n/`:
   ```bash
   # scripts/i18n/.env
   SENDWITHUS_KEY=your_api_key_here
   ```

3. **Backend .env File** (fallback):
   Add to `apps/backend/.env`:
   ```bash
   SENDWITHUS_KEY=your_api_key_here
   ```

**Note**: The scripts check these locations in order: process environment → `scripts/i18n/.env` → `apps/backend/.env`

**To get your API key**:
1. Log in to your SendWithUs account
2. Go to Settings → API Keys
3. Copy your API key (or create a new one if needed)

---

## Workflow 1: Adding a New Email Template

When you need to add a new email template to the system:

### Step 1: Create Template Files

Create a new template directory in `scripts/i18n/i18n-templates/` following the naming convention:

```
scripts/i18n/i18n-templates/Your_Template_Name_i18n/
├── html.liquid          # HTML email content
├── subject.liquid       # Email subject line
├── text.liquid         # Plain text version (optional)
├── metadata.json       # Template metadata
└── template_data.json  # Sample data for testing
```

**Naming Convention**:
- Directory name: `{Template_Name}_i18n` (use underscores, end with `_i18n`)
- Example: `Welcome_Email_i18n`, `Password_Reset_i18n`

**Template Structure**:
- All translatable strings must be wrapped in `{% trans %}...{% endtrans %}` blocks
- Variables inside trans blocks: `{% trans %}Hello {{ user_name }}{% endtrans %}`
- Extract nested variables before trans blocks:
  ```liquid
  {% set user_name = user.name %}
  {% trans %}Hello {{ user_name }}{% endtrans %}
  ```
- Control structures (if/for) must be outside trans blocks:
  ```liquid
  {% if condition %}
    {% trans %}Message{% endtrans %}
  {% endif %}
  ```

### Step 2: Upload Template to SendWithUs

Upload the template to SendWithUs using the migration script:

```bash
# Upload a specific template
node scripts/i18n/migrate-sendwithus-templates.js --template-id=tem_existing_template_id

# Or use the upload-fixed-templates script if you have the template in i18n-templates/
node scripts/i18n/upload-fixed-templates.js --template=Your_Template_Name_i18n
```

**Important**: After uploading, you must:
1. Tag the template with `i18n` in the SendWithUs dashboard (or via API)
2. Publish the new version in SendWithUs

### Step 3: Download Updated POT File

After uploading the template, SendWithUs will generate a new POT file with all translatable strings. Download it:

```bash
# Download the POT file from SendWithUs (recommended)
node scripts/i18n/download-pot-file.js --tag i18n
```

The POT file will be saved to `scripts/i18n/sendwithus-locales/template.pot`.

**Alternative**: You can download it manually via curl:
```bash
curl -H "X-SWU-API-KEY: $SENDWITHUS_KEY" \
     https://api.sendwithus.com/api/v1_0/i18n/pot/i18n \
     > scripts/i18n/sendwithus-locales/template.pot
```

### Step 4: Update Locale PO Files

For each existing locale, add translations for the new strings:

1. **Open the locale PO file** (e.g., `scripts/i18n/sendwithus-locales/es-ES.po`)
2. **Find the new strings** from the updated `template.pot` file
3. **Add translations** for each new `msgid`:
   ```po
   #: template_name.html.liquid:42
   msgid "Hello {{ user_name }}"
   msgstr "Hola {{ user_name }}"
   ```
4. **Preserve format flags**: If the string has `#, python-format`, keep it:
   ```po
   #, python-format
   msgid "Hello %(user_name)s"
   msgstr "Hola %(user_name)s"
   ```
5. **Preserve variable placeholders**: Keep all `%(variable)s` or `{{ variable }}` placeholders exactly as they appear in `msgid`

### Step 5: Upload All PO Files

After updating all locale files, upload them to SendWithUs:

```bash
# Upload all PO files
node scripts/i18n/upload-po-files.js --tag i18n

# Or upload a specific locale
node scripts/i18n/upload-po-files.js --tag i18n --locale es-ES
```

**Note**: SendWithUs will automatically generate translated template variants for each locale after upload.

---

## Workflow 2: Adding a New Locale

When you need to add support for a new language:

### Step 1: Download Current POT File

Get the latest POT file from SendWithUs:

```bash
# Download the POT file (recommended)
node scripts/i18n/download-pot-file.js --tag i18n
```

**Alternative**: You can download it manually via curl:
```bash
curl -H "X-SWU-API-KEY: $SENDWITHUS_KEY" \
     https://api.sendwithus.com/api/v1_0/i18n/pot/i18n \
     > scripts/i18n/sendwithus-locales/template.pot
```

### Step 2: Generate New Locale PO File

Create a new `.po` file for the locale in `scripts/i18n/sendwithus-locales/`:

**File naming**: Use IETF Language Tag format (e.g., `es-ES.po`, `fr-FR.po`, `de-DE.po`, `hi-IN.po`, `pt-BR.po`)

**PO File Header**:
```po
msgid ""
msgstr ""
"Project-Id-Version: Hylo Email Templates\n"
"Report-Msgid-Bugs-To: \n"
"POT-Creation-Date: 2025-01-29 12:00:00+0000\n"
"PO-Revision-Date: 2025-01-29 12:00:00+0000\n"
"Last-Translator: Your Name <your.email@example.com>\n"
"Language-Team: \n"
"Language: es-ES\n"
"MIME-Version: 1.0\n"
"Content-Type: text/plain; charset=UTF-8\n"
"Content-Transfer-Encoding: 8bit\n"
"Plural-Forms: nplurals=2; plural=(n != 1);\n"
```

**Important**: Update the `Language:` field to match your locale code (e.g., `Language: es-ES`).

### Step 3: Fill in Translations

For each entry in `template.pot`, add a corresponding entry in your new `.po` file:

```po
#: template_name.html.liquid:42
msgid "Hello {{ user_name }}"
msgstr "Hola {{ user_name }}"
```

**Translation Guidelines**:
- **Preserve format flags**: If `msgid` has `#, python-format`, include it:
  ```po
  #, python-format
  msgid "Hello %(user_name)s"
  msgstr "Hola %(user_name)s"
  ```
- **Preserve variable placeholders**: Keep all `%(variable)s` or `{{ variable }}` placeholders exactly as they appear in `msgid`
- **Maintain context**: Read the source location comment (`#: template_name.html.liquid:42`) to understand context
- **Use proper grammar**: Adapt translations to the target language's grammar rules

### Step 4: Upload New Locale PO File

Upload the new locale file to SendWithUs:

```bash
# Upload the new locale
node scripts/i18n/upload-po-files.js --tag i18n --locale es-ES
```

Replace `es-ES` with your locale code.

### Step 5: Update Locale Mapping (if needed)

If the new locale requires mapping in the backend, update `apps/backend/lib/util.js`:

```javascript
function mapLocaleToSendWithUS(locale) {
  const mapping = {
    'en': 'en-US',
    'es': 'es-ES',
    'de': 'de-DE',
    'fr': 'fr-FR',
    'hi': 'hi-IN',
    'pt': 'pt-BR',
    // Add your new locale mapping here
    'ja': 'ja-JP'
  }
  return mapping[locale] || 'en-US'
}
```

---

## Common Commands Reference

### Download POT File
```bash
# Using the script (recommended)
node scripts/i18n/download-pot-file.js --tag i18n

# Or using curl
curl -H "X-SWU-API-KEY: $SENDWITHUS_KEY" \
     https://api.sendwithus.com/api/v1_0/i18n/pot/i18n \
     > scripts/i18n/sendwithus-locales/template.pot
```

### Upload All PO Files
```bash
node scripts/i18n/upload-po-files.js --tag i18n
```

### Upload Single Locale
```bash
node scripts/i18n/upload-po-files.js --tag i18n --locale es-ES
```

### Upload Template
```bash
node scripts/i18n/upload-fixed-templates.js --template=Template_Name_i18n
```

### Dry Run (Preview Changes)
```bash
node scripts/i18n/upload-po-files.js --tag i18n --dry-run
```

---

## Troubleshooting

### "SENDWITHUS_KEY not found"
- Check that the API key is set in one of the locations mentioned in Prerequisites
- Verify the key is correct by testing with a simple API call

### "Template upload failed"
- Verify the template syntax is valid Liquid/Jinja2
- Check that all `{% trans %}` blocks are properly closed
- Ensure control structures are outside trans blocks
- Check SendWithUs dashboard for detailed error messages

### "PO file upload failed"
- Verify the `.po` file format is correct (use a PO file validator)
- Check that all `msgid` entries have corresponding `msgstr` entries
- Ensure variable placeholders match between `msgid` and `msgstr`
- Verify the tag exists in SendWithUs (check dashboard)

### "POT file doesn't match local file"
- Download the latest POT file from SendWithUs after uploading templates
- Compare local and remote POT files to identify differences
- Update local POT file and regenerate PO files if needed

---

## Best Practices

1. **Always download POT file after template changes**: SendWithUs generates the POT file automatically, so always download it after uploading new templates or template versions.

2. **Test templates before uploading**: Use the SendWithUs preview feature to test templates before uploading.

3. **Preserve variable placeholders**: Never translate variable names or placeholders like `%(variable)s` or `{{ variable }}`.

4. **Maintain format flags**: If a string uses Python-style formatting (`%(var)s`), preserve the `#, python-format` flag.

5. **Use consistent locale codes**: Follow IETF Language Tag standard (e.g., `en-US`, `es-ES`, `pt-BR`).

6. **Tag templates correctly**: All i18n templates must be tagged with `i18n` in SendWithUs.

7. **Version control**: Commit PO files to version control so translations are tracked.

8. **Review translations**: Have native speakers review translations before uploading.

---

## File Locations

- **Templates**: `scripts/i18n/i18n-templates/`
- **PO Files**: `scripts/i18n/sendwithus-locales/`
- **POT File**: `scripts/i18n/sendwithus-locales/template.pot`
- **Scripts**: `scripts/i18n/`
- **API Client**: `scripts/i18n/sendwithus-client.js`

---

## Additional Resources

- [SendWithUs i18n API Documentation](https://support.sendwithus.com/api/#internationalizationi18napi)
- [Gettext PO File Format](https://www.gnu.org/software/gettext/manual/html_node/PO-Files.html)
- [IETF Language Tags](https://en.wikipedia.org/wiki/IETF_language_tag)

