import { useMemo } from 'react'

const useShowComponentNames = () => {
    return useMemo(() => {
        try {
            const params = new URLSearchParams(window.location.search)
            if (params.has('showNames')) return true
            return localStorage.getItem('showComponentNames') === 'true'
        } catch {
            return false
        }
    }, [])
}

export default useShowComponentNames
