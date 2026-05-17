import React from "react";
import { View, Text, ActivityIndicator, StyleSheet, Dimensions } from "react-native";

const { width } = Dimensions.get("window");

export function CustomLoading() {
  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.brandText}>
          Zero<Text style={{ color: "#00C4FF" }}>Risco</Text>
        </Text>
        <Text style={styles.subText}>SAQUAREMA</Text>
        
        <View style={styles.loaderContainer}>
          <ActivityIndicator size="large" color="#FF6B00" />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0D0D0D",
    justifyContent: "center",
    alignItems: "center",
  },
  content: {
    alignItems: "center",
  },
  brandText: {
    fontSize: width * 0.12,
    fontWeight: "bold",
    color: "#FFFFFF",
    letterSpacing: -1,
  },
  subText: {
    fontSize: 14,
    color: "#00C4FF",
    letterSpacing: 8,
    marginTop: -5,
    fontWeight: "600",
    opacity: 0.9,
    textAlign: "center",
    width: "100%",
    paddingLeft: 8, // Para compensar o letterSpacing no final
  },
  loaderContainer: {
    marginTop: 50,
    height: 40,
    justifyContent: "center",
  },
});
