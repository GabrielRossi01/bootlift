package dev.rossi.orders.order;

import com.fasterxml.jackson.annotation.JsonProperty;
import java.math.BigDecimal;

public record OrderCreatedEvent(
        @JsonProperty("order_id") Long orderId,
        @JsonProperty("total") BigDecimal total) {
}
