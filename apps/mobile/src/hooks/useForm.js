import { useState, useEffect } from 'react'

export default function useForm (callback, validate) {
  const [values, setValues] = useState({})
  const [errors, setErrors] = useState({})
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    const asyncFunc = async () => {
      if (Object.keys(errors).length === 0 && isSubmitting) {
        await callback()
      }
    }
    asyncFunc()
  }, [errors])

  const handleChange = (fieldName, value) => {
    setValues(values => ({ ...values, [fieldName]: value }))
  }

  const handleSubmit = () => {
    setErrors(validate(values))
    setIsSubmitting(true)
  }

  return {
    values,
    errors,
    setValues,
    handleChange,
    handleSubmit
  }
}
