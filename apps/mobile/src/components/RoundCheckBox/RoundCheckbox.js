// BORROWING DIRECTLY FROM https://github.com/vonovak/react-native-round-checkbox
// which had an unfixed bug. For now choosing to directly import vs fork.
// https://github.com/vonovak/react-native-round-checkbox/issues/10
//
// All credit due to https://github.com/vonovak <3 
//

import * as React from 'react';
import PropTypes from 'prop-types';
import { Animated, View, TouchableWithoutFeedback, StyleSheet } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';

const hitSlop = { top: 8, bottom: 8, left: 8, right: 8 };

export default class RoundCheckbox extends React.PureComponent {
  static propTypes = {
    onValueChange: PropTypes.func,
    icon: PropTypes.string,
    size: PropTypes.number,
    backgroundColor: PropTypes.string,
    iconColor: PropTypes.string,
    borderColor: PropTypes.string,
    checked: PropTypes.bool,
    style: PropTypes.object,
  };

  static defaultProps = {
    icon: 'ios-checkmark',
    size: 24,
    backgroundColor: '#007AFF',
    iconColor: 'white',
    borderColor: 'grey',
    checked: false,
    onValueChange: () => {},
  };

  constructor(props) {
    super(props);
    this.scaleAndOpacityOfCheckbox = new Animated.Value(props.checked ? 1 : 0)
  }

  componentDidUpdate(prevProps) {
    if (this.props.checked !== prevProps.checked) {
      Animated.timing(this.scaleAndOpacityOfCheckbox, {
        toValue: this.props.checked ? 1 : 0,
        duration: 300,
        useNativeDriver: true,
      }).start();
    }
  }

  render() {
    const { size, backgroundColor, borderColor, icon, iconColor, style } = this.props;
    const iconSize = size;

    const bothStyles = {
      width: size,
      height: size,

      borderRadius: size / 2,
    };

    const checkedStyles = {
      backgroundColor,
      borderColor: backgroundColor,
      opacity: this.scaleAndOpacityOfCheckbox,
      transform: [{ scale: this.scaleAndOpacityOfCheckbox }],
      position: 'absolute',
      top: 0,
      left: 0,
    };

    return (
      <TouchableWithoutFeedback hitSlop={hitSlop} onPress={this._onPress} style={style}>
        <View style={styles.parentWrapper} shouldRasterizeIOS={true}>
          <Animated.View
            style={[
              {
                borderColor,
                backgroundColor: 'transparent',
                opacity: this.scaleAndOpacityOfCheckbox.interpolate({
                  inputRange: [0, 0.9],
                  outputRange: [1, 0],
                }),
              },
              bothStyles,
              styles.commonWrapperStyles,
            ]}
          />
          <Animated.View style={[checkedStyles, bothStyles, styles.commonWrapperStyles]}>
            <Icon
              name={icon}
              color={iconColor}
              style={{
                height: iconSize,
                fontSize: iconSize,
                backgroundColor: 'transparent',
              }}
            />
          </Animated.View>
        </View>
      </TouchableWithoutFeedback>
    );
  }

  _onPress = () => {
    this.props.onValueChange(!this.props.checked);
  };
}

const styles = StyleSheet.create({
  parentWrapper: {
    position: 'relative',
  },
  commonWrapperStyles: {
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});