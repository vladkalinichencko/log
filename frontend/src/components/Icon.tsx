import back from "../assets/icons/back.svg";
import forward from "../assets/icons/forward.svg";
import plus from "../assets/icons/plus.svg";
import trash from "../assets/icons/trash.svg";

const ICONS = { back, forward, plus, trash };

interface IconProps {
  name: keyof typeof ICONS;
}

export function Icon({ name }: IconProps) {
  return <img className="icon" src={ICONS[name]} alt={name} />;
}
