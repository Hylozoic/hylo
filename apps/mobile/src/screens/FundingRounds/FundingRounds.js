import React from 'react'
import { View, FlatList, Text } from 'react-native'
import { useTranslation } from 'react-i18next'
import { RESP_MANAGE_ROUNDS } from 'store/constants'
import useCurrentGroup from '@hylo/hooks/useCurrentGroup'
import useHasResponsibility from '@hylo/hooks/useHasResponsibility'
import useFundingRounds from '@hylo/hooks/useFundingRounds'
import FundingRoundCard from 'components/FundingRoundCard'
import StreamHeader from '../Stream/StreamHeader'
import Loading from 'components/Loading'

function FundingRounds () {
  const { t } = useTranslation()
  const [{ currentGroup }] = useCurrentGroup()
  const hasResponsibility = useHasResponsibility({ forCurrentGroup: true, forCurrentUser: true })
  const canManageRounds = hasResponsibility(RESP_MANAGE_ROUNDS)
  const [fundingRounds, { fetching, error }] = useFundingRounds({
    groupId: currentGroup?.id,
    hideUnpublished: !canManageRounds
  })

  if (error) {
    return (
      <Text className='text-error text-center py-4'>
        {t('Error loading funding rounds')}
      </Text>
    )
  }

  const renderFundingRound = ({ item: fundingRound }) => (
    <FundingRoundCard fundingRound={fundingRound} />
  )

  return (
    <View className='flex-1 bg-background'>
      <StreamHeader
        name={t('Funding Rounds')}
        image={currentGroup.bannerUrl ? { uri: currentGroup.bannerUrl } : null}
        iconName='BadgeDollarSign'
        currentGroup={currentGroup}
        postPrompt={false}
        streamType='funding-rounds'
      />
      {fetching && <Loading />}
      {fundingRounds.length === 0 && !fetching && (
        <Text className='text-foreground text-center py-4 font-bold text-lg'>
          {t('This group currently does not have any published funding rounds')}
        </Text>
      )}
      {fundingRounds.length === 0 && canManageRounds && !fetching && (
        <Text className='text-foreground text-center py-2 font-bold text-lg'>
          {t('Funding rounds can be created by admins in the web app for Hylo')}
        </Text>
      )}
      <FlatList
        data={fundingRounds}
        renderItem={renderFundingRound}
        keyExtractor={fundingRound => fundingRound.id}
        contentContainerClassName='p-4 gap-y-2'
      />
    </View>
  )
}

export default FundingRounds
