import { readonly, ref } from 'vue'

export default function useCommentLogout(logoutSession: () => Promise<void>) {
	const pending = ref(false)
	const failed = ref(false)

	async function logout() {
		if (pending.value)
			return
		pending.value = true
		failed.value = false
		try {
			await logoutSession()
		}
		catch {
			failed.value = true
		}
		finally {
			pending.value = false
		}
	}

	return {
		pending: readonly(pending),
		failed: readonly(failed),
		logout,
	}
}
