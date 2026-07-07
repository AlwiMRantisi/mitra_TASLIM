import { useEffect } from "react";

export function useDisableContextMenu() {
	useEffect(() => {
		const handleContextMenu = (event: MouseEvent) => event.preventDefault();

		document.addEventListener("contextmenu", handleContextMenu);
		return () => document.removeEventListener("contextmenu", handleContextMenu);
	}, []);
}
