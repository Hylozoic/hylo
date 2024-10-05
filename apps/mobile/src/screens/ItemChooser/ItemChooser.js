import React from 'react'
import PropTypes from 'prop-types'
import {
  SectionList,
  Text,
  View,
  TouchableOpacity
} from 'react-native'
import { isEqual, isFunction, debounce } from 'lodash/fp'
import ModalHeader from 'navigation/headers/ModalHeader'
import SearchBar from 'components/SearchBar'
import styles from './ItemChooser.styles'
import { withTranslation } from 'react-i18next'

export const propTypesForItemRowComponent = {
  item: PropTypes.object.isRequired,
  chosen: PropTypes.bool.isRequired,
  toggleChosen: PropTypes.func,
  chooseItem: PropTypes.func,
  unChooseItem: PropTypes.func,
  pickItem: PropTypes.func
}

class ItemChooser extends React.Component {
  static propTypes = {
    // From screen / route.params
    screenTitle: PropTypes.string,
    ItemRowComponent: PropTypes.func.isRequired,
    fetchSearchSuggestions: PropTypes.func.isRequired,
    getSearchSuggestions: PropTypes.func,
    pickItem: PropTypes.func,
    updateItems: PropTypes.func,
    initialItems: PropTypes.arrayOf(
      PropTypes.shape({
        id: PropTypes.string.isRequired
      })
    ),
    defaultSuggestedItems: PropTypes.arrayOf(
      PropTypes.shape({
        id: PropTypes.string.isRequired
      })
    ),
    defaultSuggestedItemsLabel: PropTypes.string,
    searchTermFilter: PropTypes.func,
    searchPlaceholder: PropTypes.string,
    // Regular props mostly from connector
    setSearchTerm: PropTypes.func.isRequired,
    searchTerm: PropTypes.oneOfType([
      PropTypes.string,
      PropTypes.object
    ]),
    suggestedItems: PropTypes.array,
    loading: PropTypes.bool,
    style: PropTypes.object
  }

  static defaultProps = {
    searchTerm: undefined,
    initialItems: [],
    suggestedItems: []
  }

  state = {
    chosenItems: []
  }

  constructor (props) {
    super(props)

    this.state = {
      chosenItems: this.props.initialItems,
      initialItems: this.props.initialItems,
      searchPlaceholder: this.props.t('Begin type to searching')
    }
  }

  componentDidUpdate () {
    this.setHeader()
  }

  componentDidMount () {
    const { initialSearchTerm, initialItems, updateItems } = this.props
    if (updateItems) this.updateItems(initialItems)
    if (initialSearchTerm) this.setSearchTerm(initialSearchTerm)
    this.setHeader()
  }

  componentWillUnmount () {
    this.clearSearchTerm()
  }

  setHeader = () => {
    const { navigation, screenTitle, updateItems, t } = this.props
    const { chosenItems, initialItems } = this.state
    const headerProps = {
      title: screenTitle,
      headerLeftConfirm: !isEqual(chosenItems, initialItems)
    }
    if (isFunction(updateItems)) {
      headerProps.headerRightButtonLabel = t('Done')
      headerProps.headerRightButtonOnPress = this.done
    }
    navigation.setOptions({
      header: props => <ModalHeader {...props} {...headerProps} />
    })
  }

  done = () => {
    const { navigation } = this.props
    const { chosenItems } = this.state
    this.props.updateItems(chosenItems)
    navigation.goBack()
  }

  addItem = item => {
    const updatedItems = this.state.chosenItems.concat(item)
    this.updateItems(updatedItems)
  }

  removeItem = item => {
    const updatedItems = this.state.chosenItems.filter(p => p.id !== item.id)
    this.updateItems(updatedItems)
  }

  updateItems = updatedItems => {
    this.setState(state => ({ chosenItems: updatedItems }))
  }

  pickItem = item => {
    this.props.pickItem(item)
    this.props.navigation.goBack()
  }

  setupItemSections = suggestedItems => {
    const { searchTerm, defaultSuggestedItems, defaultSuggestedItemsLabel, updateItems, t } = this.props
    const { chosenItems, initialItems } = this.state
    const chosenItemIds = chosenItems.map(p => p.id)
    const initialItemIds = initialItems.map(item => item.id)
    const addSelected = items => items.map(item => ({
      ...item,
      chosen: chosenItemIds.includes(item.id)
    }))
    const sections = []
    const addedItems = chosenItems.filter(item => !initialItemIds.includes(item.id))
    // chooser
    if (updateItems) {
      if (searchTerm) return [{ data: addSelected(suggestedItems) }]
      if (initialItems.length > 0) {
        const label = addedItems.length > 0 ? t('Current Selection') : undefined
        sections.push({ label, data: addSelected(initialItems) })
      }
      if (addedItems.length > 0) {
        sections.push({ label: t('Added'), data: addSelected(addedItems) })
      }
    // picker
    } else {
      if (searchTerm) {
        const filteredSuggestedItems = suggestedItems.filter(item => !initialItemIds.includes(item.id))
        return [{ data: filteredSuggestedItems }]
      }
      if (defaultSuggestedItems && defaultSuggestedItemsLabel) {
        const label = defaultSuggestedItems.length > 0 ? defaultSuggestedItemsLabel : undefined
        const addedItemIds = addedItems.filter(item => item.id)
        const filteredDefaultItems = defaultSuggestedItems
          .filter(item => !initialItemIds.includes(item.id))
          .filter(item => !addedItemIds.includes(item.id))
        if (defaultSuggestedItems.length > 0) {
          sections.push({ label, data: addSelected(filteredDefaultItems) })
        }
      }
    }
    return sections
  }

  setSearchTerm = searchTerm => {
    this.props.setSearchTerm(searchTerm)
    this.fetchSearchSuggestions(searchTerm)
  }

  fetchSearchSuggestions = debounce(400, (searchTerm) =>
    this.props.fetchSearchSuggestions && this.props.fetchSearchSuggestions(searchTerm)
  )

  clearSearchTerm = () => this.props.setSearchTerm()

  renderItemRowComponent = ({ item }) => {
    const { ItemRowComponent } = this.props
    const toggleChosen = item.chosen ? this.removeItem : this.addItem
    const chooseItem = () => this.addItem(item)
    const unChooseItem = () => this.removeItem(item)
    const pickItem = transformedItem => this.pickItem(transformedItem || item)

    return (
      <ItemRowComponent
        item={item}
        chosen={item.chosen}
        chooseItem={chooseItem}
        toggleChosen={toggleChosen}
        unChooseItem={unChooseItem}
        onPress={pickItem}
      />
    )
  }

  render () {
    const { searchTerm, style, suggestedItems, t } = this.props
    const headerText = searchTerm ? `${t('Matching')} "${searchTerm}"` : undefined
    const sections = this.setupItemSections(suggestedItems)

    return (
      <View style={style}>
        <ItemChooserListHeader
          {...this.props}
          autoFocus
          headerText={headerText}
          setSearchTerm={this.setSearchTerm}
          clearSearchTerm={this.clearSearchTerm}
        />
        <SectionList
          style={styles.itemList}
          sections={sections}
          renderSectionHeader={SectionHeader}
          renderItem={this.renderItemRowComponent}
          ListFooterComponent={<View style={styles.sectionFooter} />}
          keyExtractor={item => item.id}
          stickySectionHeadersEnabled
          keyboardShouldPersistTaps='handled'
        />
      </View>
    )
  }
}

export function SectionHeader ({ section: { label } }) {
  if (!label) return null
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionHeaderText}>{label.toUpperCase()}</Text>
    </View>
  )
}

export class ItemChooserListHeader extends React.Component {
  render () {
    const {
      searchTerm,
      headerText,
      setSearchTerm,
      clearSearchTerm,
      searchPlaceholder,
      autoFocus,
      onFocus,
      loading,
      t
    } = this.props
    return (
      <View style={styles.listHeader}>
        <SearchBar
          style={styles.searchBar}
          autoFocus={autoFocus}
          onFocus={onFocus}
          value={searchTerm}
          onChangeText={setSearchTerm}
          placeholder={searchPlaceholder || this?.state?.searchPlaceholder}
          // onCancel={clearSearchTerm}
          // onCancelText='Clear'
          loading={loading}
        />
        {searchTerm && (
          <View style={styles.listHeaderStatus}>
            <Text style={styles.listHeaderText}>
              <Text>{headerText}</Text>
            </Text>
            <TouchableOpacity onPress={clearSearchTerm}>
              <Text style={styles.listHeaderClear}>{t('Clear Search')}</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    )
  }
}

export default withTranslation()(ItemChooser)
