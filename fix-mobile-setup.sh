#!/bin/bash
echo "🔧 Fixing Hylo Mobile Development Setup..."

# Disable RVM for cleaner Ruby environment
echo "Disabling RVM project configuration..."
echo 'rvm_project_rvmrc=0' >> ~/.rvmrc

# Add necessary paths to shell
echo "Adding paths to ~/.zshrc..."
cat << 'EOF' >> ~/.zshrc

# Mobile Development Setup
export ANDROID_HOME=/Users/aaronbrodeur/Library/Android/sdk
export PATH=$PATH:$ANDROID_HOME/emulator
export PATH=$PATH:$ANDROID_HOME/platform-tools
export PATH="/usr/local/opt/ruby/bin:/usr/local/lib/ruby/gems/3.4.0/bin:$PATH"

# Java for Android (will use system Java or install OpenJDK 11)
export JAVA_HOME=$(/usr/libexec/java_home -v 11 2>/dev/null || /usr/libexec/java_home)
EOF

echo "Reloading shell configuration..."
source ~/.zshrc

echo "Installing CocoaPods with system Ruby..."
/usr/local/opt/ruby/bin/gem install cocoapods

echo "Installing iOS dependencies..."
cd apps/mobile/ios && /usr/local/lib/ruby/gems/3.4.0/bin/pod install

echo "✅ Setup complete! Try running:"
echo "  cd apps/mobile"
echo "  npm start      # Start Metro bundler"
echo "  npm run ios    # Run iOS app"
echo "  npm run android # Run Android app"