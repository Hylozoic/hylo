import React from 'react'
import { withTranslation } from 'react-i18next'
import Loading from 'components/Loading'
import PostCard from 'components/PostCard'
import CommentCard from 'components/CommentCard'

class RecentActivity extends React.Component {
  static defaultProps = {
    routeParams: {}
  }

  state = {
    offset: 0,
    items: [],
    loadingMore: false
  }

  componentDidMount () {
    this.loadInitial()
  }

  componentDidUpdate (prevProps, prevState) {
    // If activityItems prop changes, update local items
    if (prevProps.activityItems !== this.props.activityItems) {
      // If offset is 0, replace; otherwise, append
      this.setState(state => ({
        items: this.state.offset === 0 ? this.props.activityItems : [...state.items, ...this.props.activityItems],
        loadingMore: false
      }))
    }
  }

  loadInitial = () => {
    this.setState({ offset: 0, items: [] }, () => {
      this.props.fetchRecentActivity(0)
    })
  }

  loadMore = () => {
    if (this.state.loadingMore || !this.props.hasMore) return
    this.setState(
      state => ({ loadingMore: true, offset: state.offset + 10 }),
      () => this.props.fetchRecentActivity(this.state.offset + 10)
    )
  }

  itemSelected = selectedItemId => selectedItemId === this.props.routeParams.postId

  handleScroll = e => {
    const { scrollTop, scrollHeight, clientHeight } = e.target
    if (scrollHeight - scrollTop - clientHeight < 100) {
      this.loadMore()
    }
  }

  render () {
    const { t } = this.props
    if (this.props.loading && this.state.offset === 0) return <Loading />

    const { items, loadingMore } = this.state

    return (
      <div style={{ overflowY: 'auto', maxHeight: '80vh' }} onScroll={this.handleScroll}>
        {items && items.map((item, i) => (
          <div className='bg-transparent' key={i} data-testid='activity-item'>
            {Object.prototype.hasOwnProperty.call(item, 'title')
              ? <PostCard post={item} expanded={this.itemSelected(item.id)} />
              : <CommentCard comment={item} expanded={this.itemSelected(item.post.id)} />}
          </div>
        ))}
        {loadingMore && <Loading />}
        {!this.props.hasMore && !loadingMore && (
          <div className='text-center text-gray-500 py-4'>{t('No more activity to load')}</div>
        )}
      </div>
    )
  }
}

export default withTranslation()(RecentActivity)
