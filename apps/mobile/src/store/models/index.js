import { ORM } from 'redux-orm'
import './Model.extension'

export const orm = new ORM({ stateSelector: state => state.orm })

export default orm
