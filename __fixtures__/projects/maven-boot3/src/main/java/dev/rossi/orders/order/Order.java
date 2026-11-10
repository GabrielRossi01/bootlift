package dev.rossi.orders.order;

import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.validation.constraints.NotBlank;
import java.math.BigDecimal;

@Entity
public class Order {

    @Id
    @GeneratedValue
    private Long id;

    @NotBlank
    private String customer;

    private BigDecimal total;

    protected Order() {
    }

    public Order(String customer, BigDecimal total) {
        this.customer = customer;
        this.total = total;
    }

    public Long getId() {
        return id;
    }

    public String getCustomer() {
        return customer;
    }

    public BigDecimal getTotal() {
        return total;
    }
}
