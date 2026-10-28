import React from 'react'
import { graphql, HttpResponse } from 'msw'
import mockGraphqlServer from 'util/testing/mockGraphqlServer'
import { AllTheProviders, fireEvent, render, screen, waitFor } from 'util/testing/reactTestingLibraryExtended'
import ResponsibilitiesTab from './ResponsibilitiesTab'

describe('ResponsibilitiesTab', () => {
  beforeEach(() => {
    mockGraphqlServer.use(
      graphql.query('fetchResponsibiltiesForGroup', () => HttpResponse.json({
        data: {
          responsibilities: [
            { id: '1', title: 'Administration', type: 'system', description: 'Manage the group' },
            { id: '41', title: 'Add Members', type: 'system', description: 'Invite and add new people' },
            { id: '70', title: 'Greet Newcomers', type: 'group', description: 'Say hello' }
          ]
        }
      }))
    )
  })

  it('lists the built-in and custom responsibilities', async () => {
    render(<ResponsibilitiesTab group={{ id: '1' }} />, { wrapper: AllTheProviders() })

    expect(await screen.findByText('Administration')).toBeInTheDocument()
    expect(screen.getByText('Add Members')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Greet Newcomers')).toBeInTheDocument()
  })

  describe('when the server refuses a title', () => {
    let alertSpy

    beforeEach(() => {
      alertSpy = jest.spyOn(window, 'alert').mockImplementation(() => {})
    })

    afterEach(() => alertSpy.mockRestore())

    function refuseWith (message) {
      mockGraphqlServer.use(
        graphql.operation(({ query }) => {
          if (query.includes('addGroupResponsibility') || query.includes('updateGroupResponsibility')) {
            return HttpResponse.json({ data: null, errors: [{ message }] })
          }
        })
      )
    }

    async function createDraft (title) {
      render(<ResponsibilitiesTab group={{ id: '1' }} />, { wrapper: AllTheProviders() })
      await screen.findByDisplayValue('Greet Newcomers')
      fireEvent.click(screen.getByText('Create new responsibility'))
      fireEvent.change(screen.getAllByDisplayValue('')[0], { target: { value: title } })
      fireEvent.click(screen.getByRole('button', { name: /Create/ }))
    }

    it('says a built-in responsibility already has the name', async () => {
      refuseWith('A built-in responsibility already has this title')
      await createDraft('Add Members')

      await waitFor(() => expect(alertSpy).toHaveBeenCalledWith('A built-in responsibility already has this name. Please choose another.'))
      expect(screen.getByDisplayValue('Add Members')).toBeInTheDocument()
    })

    it('says something went wrong for any other refusal', async () => {
      refuseWith('Something else')
      await createDraft('Welcome Committee')

      await waitFor(() => expect(alertSpy).toHaveBeenCalledWith('There was an error, please try again.'))
    })

    it('says the same when renaming a custom responsibility', async () => {
      refuseWith('A built-in responsibility already has this title')
      render(<ResponsibilitiesTab group={{ id: '1' }} />, { wrapper: AllTheProviders() })
      fireEvent.change(await screen.findByDisplayValue('Greet Newcomers'), { target: { value: 'Add Members' } })
      fireEvent.click(screen.getByRole('button', { name: /Save/ }))

      await waitFor(() => expect(alertSpy).toHaveBeenCalledWith('A built-in responsibility already has this name. Please choose another.'))
    })
  })

})
