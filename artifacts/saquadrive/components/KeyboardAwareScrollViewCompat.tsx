import React from "react";
  import { ScrollView, ScrollViewProps } from "react-native";

  type Props = ScrollViewProps & { children?: React.ReactNode };

  /**
   * Substituto de KeyboardAwareScrollView sem dependência de react-native-keyboard-controller.
   * Usa ScrollView nativo com keyboardShouldPersistTaps="handled".
   */
  export function KeyboardAwareScrollViewCompat({
    children,
    keyboardShouldPersistTaps = "handled",
    ...props
  }: Props) {
    return (
      <ScrollView keyboardShouldPersistTaps={keyboardShouldPersistTaps} {...props}>
        {children}
      </ScrollView>
    );
  }
  