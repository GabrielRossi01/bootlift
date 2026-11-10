package dev.rossi.billing.invoice;

import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Positive;
import java.math.BigDecimal;

public record Invoice(
        @JsonProperty("customer_id") @NotBlank String customerId,
        @JsonProperty("amount") @Positive BigDecimal amount) {
}
