# Make Subscriptions for All Mutations

This document outlines an experimental setup to automatically generate and handle subscriptions for all GraphQL mutations in a schema. The goal is to dynamically add subscriptions for every mutation in the form of `<mutationName>Done`, where each subscription listens for events published after a mutation completes. The setup includes extending the schema, publishing events for mutations, and handling subscriptions.

---

## Overview

The setup involves:

1. **Dynamically extending the schema** to add subscription fields corresponding to each mutation.
2. **A plugin to publish events** for mutations after they execute.
3. **A subscription resolver** for handling these dynamically generated subscription fields.
4. **Integration with the server** to apply the schema and plugin.

---

## Dynamically Extend Schema with Subscriptions

The following code dynamically adds subscription fields for all mutations in the form of `<mutationName>Done`. Each subscription returns the same type as the mutation and listens for events published on a specific channel.

```javascript
import { mapSchema, getDirective, MapperKind } from '@graphql-tools/utils'
import { GraphQLObjectType } from 'graphql'

/**
 * Dynamically extend the schema to create subscriptions for all mutations.
 * @param {GraphQLSchema} schema - The original schema.
 * @param {Object} pubSub - An instance of PubSub for handling subscriptions.
 * @returns {GraphQLSchema} - The extended schema with subscriptions.
 */
export function extendSchemaWithSubscriptions(schema, pubSub) {
  const mutationType = schema.getMutationType()
  const mutationFields = mutationType.getFields()

  // Create subscription fields based on mutation fields
  const subscriptionFields = {}
  for (const [mutationName, mutationField] of Object.entries(mutationFields)) {
    subscriptionFields[`${mutationName}Done`] = {
      type: mutationField.type, // Use the same return type as the mutation
      description: `Triggered when ${mutationName} is completed.`,
      subscribe: (_, __, context) => {
        const channelName = `${mutationName}Done`
        return pubSub.subscribe(channelName)
      },
      resolve: (payload) => payload
    }
  }

  // Extend the existing schema with the new subscription fields
  const extendedSchema = mapSchema(schema, {
    [MapperKind.SUBSCRIPTION]: (type) => {
      if (type.name === 'Subscription') {
        const fields = type.getFields()
        return new GraphQLObjectType({
          name: 'Subscription',
          fields: {
            ...fields,
            ...subscriptionFields
          }
        })
      }
      return type
    }
  })

  return extendedSchema
}
```

---

## Plugin to Publish Events for Mutations

This plugin hooks into the GraphQL execution pipeline and publishes an event for each mutation upon completion. The channel name is derived from the mutation name, and the payload includes the result of the mutation.

```javascript
import { handleStreamOrSingleExecutionResult } from '@envelop/core'

/**
 * A plugin to publish events for all mutations.
 * The events are published with a channel name `<mutationName>Done` and a payload containing `{ channelName: result.data[mutationName] }`.
 */
const useMutationSubscriptionResponder = () => {
  return {
    onExecute({ args }) {
      const { contextValue } = args

      // Check if the operation is a mutation
      const isMutation = args?.document.definitions.some(
        (definition) =>
          definition.kind === 'OperationDefinition' &&
          definition.operation === 'mutation'
      )

      return {
        onExecuteDone(payload) {
          if (isMutation) {
            return handleStreamOrSingleExecutionResult(payload, ({ result }) => {
              // Find the mutation name from the document
              const mutationName = args?.document.definitions
                ?.flatMap(def => def.selectionSet.selections)
                ?.find(selection => selection.kind === 'Field')?.name?.value

              if (!mutationName) {
                console.log('No mutation name found. Skipping event publishing.')
                return
              }

              // Extract the mutation result from the response
              const mutationResult = result.data?.[mutationName]
              if (!mutationResult) {
                console.warn(`No result data found for mutation: ${mutationName}`)
                return
              }

              // Construct the channel name dynamically
              const channelName = `${mutationName}Done`

              // Publish the event with the channel name and payload
              contextValue.pubSub.publish(channelName, {
                [channelName]: mutationResult
              })

              console.log(`Published event to channel ${channelName}:`, mutationResult)
            })
          }
        }
      }
    }
  }
}

export default useMutationSubscriptionResponder
```

---

## Example Subscription Resolver

Below is an example subscription resolver that handles the dynamically generated subscription field. It listens to the published events and resolves the payload to the subscriber.

```javascript
// Subscription resolver would look something like this:
createCommentDone: {
  subscribe: (parent, { postId }, context) => pipe(
    context.pubSub.subscribe('createCommentDone'),
    withDontSendToCreator({ context, getter: get('createCommentDone.creator.id') })
  ),
  resolve: (payload) => {
    const inferredKey = Object.keys(payload)[0]
    console.log('!!!! payload[inferredKey]', payload[inferredKey])
    // Rehydrate the JSON serialized and re-parsed Bookshelf instance
    // return new Comment(payload[inferredKey])
  }
}
```

---

## Applying the Schema and Plugin

Finally, integrate the extended schema and the mutation subscription plugin into your server setup. Here's how:

```javascript
export const createRequestHandler = () =>
  createServer({
    plugins: [
      useLazyLoadedSchema(createSchema),
      useMutationSubscriptionResponder()
    ],
    context: ({ request }) => ({
      pubSub: new PubSub(),
      request
    })
  })
```

---

## Risks and Considerations

1. **Scalability Concerns**: Adding subscriptions for all mutations could be inefficient, this has not been considered.
2. **Selective Implementation**: Consider introducing a flag or directive (e.g., `@addSubscription`) to explicitly mark which mutations should have associated subscriptions.
3. **Error Handling**: Ensure robust error handling for cases where events fail to publish or subscribers experience issues.

---

## Summary

This setup demonstrates how to dynamically generate subscriptions for all mutations in a GraphQL schema and handle their execution lifecycle. The goal is to simplify event-driven patterns in GraphQL by ensuring every mutation automatically emits a subscription event when it completes.

While this approach can save time and effort for developers, it’s essential to consider the potential overhead and scalability concerns. Introducing flags or directives to enable this behavior selectively can help balance functionality with performance. For instance, applying a directive like `@addSubscription` to mutations could allow developers to opt-in only for those mutations that genuinely need subscription support.
