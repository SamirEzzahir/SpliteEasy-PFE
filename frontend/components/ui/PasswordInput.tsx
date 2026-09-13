"use client";
import { useState, type InputHTMLAttributes } from "react";
import { Eye, EyeOff } from "lucide-react";

export default function PasswordInput(props: Omit<InputHTMLAttributes<HTMLInputElement>, "type">) {
  const [visible, setVisible] = useState(false);
  return <span className="password-field">
    <input {...props} type={visible ? "text" : "password"} />
    <button type="button" aria-label={visible ? "Hide password" : "Show password"} aria-pressed={visible}
      onClick={() => setVisible(!visible)}>{visible ? <EyeOff size={18} /> : <Eye size={18} />}</button>
  </span>;
}
